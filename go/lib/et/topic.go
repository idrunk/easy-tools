package et

import (
	"context"
	"crypto/md5"
	"fmt"
	"regexp"
	"server/lib/app"
	"strings"
	"time"

	"github.com/coder/websocket"
	"go.drunkce.com/dce/converter"
	"go.drunkce.com/dce/proto"
	"go.drunkce.com/dce/proto/flex"
	"go.drunkce.com/dce/session"
	"go.drunkce.com/dce/util"
)

const topicExpires = 86400 * 2

const (
	KeyAddrs uint8 = iota
	KeyTopic
	KeyForeign
)

type Topic struct {
	*PbTopic
	foundById bool
}

func FromPB(pb *PbTopic) *Topic {
	pb.Id = strings.TrimSpace(pb.Id)
	pb.Key = util.Ref(strings.TrimSpace(pb.GetKey()))
	return &Topic{PbTopic: pb}
}

func FindTopic(ctx context.Context, id string) (topic *Topic, err error) {
	if id = strings.TrimSpace(id); len(id) == 0 {
		return nil, util.Openly0("ID不能为空")
	}
	foundById := true
	if len(id) <= 64 {
		id, err = app.Rdb.Get(ctx, skey(id, KeyForeign)).Result()
		if err != nil {
			return
		} else if id == "" {
			return nil, util.Openly0("没找到ID为 %s 的主题会话", id)
		}
		foundById = false
	}
	m, err := app.Rdb.HGetAll(ctx, skey(id, KeyTopic)).Result()
	if err != nil {
		return nil, err
	}
	topic = &Topic{
		PbTopic: &PbTopic{Id: id},
		foundById: foundById,
	}
	if v, ok := m["key"]; ok {
		topic.Key = &v
	}
	if v, ok := m["secret"]; ok {
		topic.Secret = &v
	}
	return
}

func skey(id string, ty uint8) string {
	if ty == KeyForeign {
		return fmt.Sprintf("topkey:%s", id)	
	}
	return fmt.Sprintf("topic:%s:%d", id, ty)
}

func (t *Topic) skey(ty uint8) string {
	return skey(util.Iif(ty == KeyForeign, t.GetKey(), t.Id), ty)
}

func (t *Topic) Modify(ctx context.Context) error {
	m := make(map[string]string)
	st, _ := FindTopic(ctx, t.Id)
	if v := t.GetSecret(); v != "" {
		m["secret"] = v
		key := t.GetKey()
		if ! regexp.MustCompile(`^[\w-]{5,32}$`).MatchString(key) {
			return util.Openly0("ID必须为长度在 5-32 之间的字母数字短横线或下划线组合，建议用简单好记的单词/拼音以横线分隔组合")
		}
		if _, err := FindTopic(ctx, key); err == nil || (st != nil && st.Key != nil) {
			// 无登录机制，为防止他人改密，所以直接禁止修改
			return util.Openly0("该ID已被使用，请更换一个。（若需改密，请新建会话设置新密）")
		}
		m["key"] = key
		// log the foreign key
		app.Rdb.Set(ctx, t.skey(KeyForeign), t.Id, topicExpires * time.Second).Err()
	}
	if len(m) == 0 {
		return util.Openly0("输入信息不完整")
	}
	if err := app.Rdb.HSet(ctx, t.skey(KeyTopic), m).Err(); err != nil {
		return err
	}
	return app.Rdb.Expire(ctx, t.skey(KeyTopic), topicExpires * time.Second).Err()
}

func (t *Topic) authKey() string {
	return fmt.Sprintf("et:%s", t.Id)
}

func (t *Topic) Authorize(ctx *proto.Http, key, secret string) error {
	// 非以ID打开的都需鉴权
	if !t.foundById && (key != t.GetKey() || secret != t.GetSecret()) {
		return util.Openly(403, "Forbidden")
	}
	sess := ctx.Rp.Session()
	ctx.Rp.SetRespSid(sess.Id())
	return sess.Set(t.authKey(), 1)
}

func (t *Topic) Authenticate(sess session.IfSession) error {
	var has int
	if err := sess.Get(t.authKey(), &has); err != nil {
		return err
	} else if has == 0 {
		return util.Openly(403, "Forbidden")
	}
	return nil
}

func (t *Topic) Renewal(ctx context.Context) {
	app.Rdb.Expire(ctx, t.skey(KeyAddrs), topicExpires * time.Second)
	app.Rdb.Expire(ctx, t.skey(KeyTopic), topicExpires * time.Second)
	app.Rdb.Expire(ctx, t.skey(KeyForeign), topicExpires * time.Second)
}

func (t *Topic) Broadcast(ctx *flex.Websocket, sig *PbSignalling) error {
	app.Rdb.SAdd(ctx, t.skey(KeyAddrs), ctx.Rp.Req.RemoteAddr)
	t.Renewal(ctx)
	addrs, err := app.Rdb.SMembers(ctx, t.skey(KeyAddrs)).Result()
	if err != nil {
		return err
	}
	sig.Sender = util.Ref(addrDesensitization(ctx.Rp.Req.RemoteAddr))
	pf := converter.PbRawResponser[*flex.WebsocketProtocol, *PbSignalling](ctx)
	for _, addr := range addrs {
		if addr == ctx.Rp.Req.RemoteAddr {
			continue
		}
		conn, ok := flex.WebsocketRouter.ConnBy(addr)
		if !ok {
			app.Rdb.SRem(ctx, t.skey(KeyAddrs), addr)
			continue
		}
		sig.Receiver = util.Ref(addrDesensitization(addr))
		if sigBytes, err := pf.Serialize(sig); err == nil {
			pkg := flex.NewPackage(ctx.Rp.Path(), sigBytes, "", 0)
			go conn.Write(ctx, websocket.MessageBinary, pkg.Serialize())
		}
	}
	return nil
}

func (t *Topic) SendTo(ctx *flex.Websocket, sig *PbSignalling) error {
	if addrs, err := app.Rdb.SMembers(ctx, t.skey(KeyAddrs)).Result(); err == nil {
		for _, addr := range addrs {
			if addrDesensitization(addr) == *sig.Receiver {
				if conn, ok := flex.WebsocketRouter.ConnBy(addr); ok {
					pf := converter.PbRawResponser[*flex.WebsocketProtocol, *PbSignalling](ctx)
					if sigBytes, err := pf.Serialize(sig); err == nil {
						pkg := flex.NewPackage(ctx.Rp.Path(), sigBytes, "", 0)
						go conn.Write(ctx, websocket.MessageBinary, pkg.Serialize())
					}
				}
				break
			}
		}
	}
	return nil
}

func addrDesensitization(addr string) string {
	parts := strings.SplitN(addr, ".", 2)
	hash := md5.New()
	hash.Write([]byte(parts[1]))
	return fmt.Sprintf("%s-%s", parts[0], fmt.Sprintf("%x", hash.Sum(nil))[:10])
}
