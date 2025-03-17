package api

import (
	"log/slog"
	"math"
	"math/rand"
	"net/http"

	"server/lib/app"
	"server/lib/et"

	"go.drunkce.com/dce/converter"
	"go.drunkce.com/dce/proto"
	"go.drunkce.com/dce/proto/flex"
	"go.drunkce.com/dce/router"
	"go.drunkce.com/dce/session"
)

func EasyTransferApis() {
	// 生成会话主题ID
	proto.HttpRouter.Get("api/et/tid", func(c *proto.Http) {
		tid, _ := session.GenSid(uint16(rand.Intn(math.MaxUint16)))
		c.WriteString(tid)
	})

	// 取会话信息
	proto.HttpRouter.Get("api/et/{tid}/auth", func(c *proto.Http) {
		pc := converter.PbJsonRawResponser[*proto.HttpProtocol, *et.PbTopic](c)
		topic, err := et.FindTopic(c, c.Param("tid"))
		if err != nil && pc.Fail("Notfound", 404) {
			return
		}
		if err = topic.Authenticate(c.Rp.Session()); err != nil {
			// 如果鉴权失败，则尝试获取授权
			if err = topic.Authorize(c, "", ""); err != nil && pc.Error(err) {
				return
			}
		}
		if respSid := c.Rp.RespSid(); respSid == "" {
			// 若未自动设置响应SID（仅在初次鉴权时响应），则响应以便更新浏览器cookie的ttl
			sess := c.Rp.Session()
			c.Rp.SetRespSid(sess.Id())
		}
		pc.Response(topic.PbTopic)
	})

	// 会话访问鉴权
	proto.HttpRouter.Post("api/et/{tid}/auth", func(c *proto.Http) {
		pc := converter.PbJsonRawResponser[*proto.HttpProtocol, *et.PbTopic](c)
		pt, ok := converter.PbJsonRawRequester[*proto.HttpProtocol, *et.PbTopic](c).Parse()
		if !ok && pc.Fail("Unauthorized", 401) {
			return
		}
		topic, err := et.FindTopic(c, c.Param("tid"))
		if err != nil && pc.Fail("Notfound", 404) {
			return
		}
		if err = topic.Authorize(c, pt.GetKey(), pt.GetSecret()); err != nil && pc.Error(err) {
			return
		}
		pc.Response(topic.PbTopic)
	})

	// 设置短连接私密会话
	proto.HttpRouter.Patch("api/et/{tid}", func(c *proto.Http) {
		pc := converter.PbJsonStatusResponser(c)
		pt, ok := converter.PbJsonRawRequester[*proto.HttpProtocol, *et.PbTopic](c).Parse()
		if !ok {
			return
		}
		pt.Id = c.Param("tid")
		topic := et.FromPB(pt)
		if err := topic.Modify(c); err != nil && pc.Error(err) {
			return
		}
		pc.Success(nil)
	})

	proto.HttpRouter.Raw().SetEventHandler(func(ctx *proto.Http) error {
		return app.NewSession(ctx.Rp)
	}, func(ctx *proto.Http) error {
		if sid := ctx.Rp.RespSid(); sid != "" {
			cookie := &http.Cookie{
				Name: proto.HeaderSidKey,
				Value: sid,
				Path: "/",
				HttpOnly: true,
				Secure: false,
				SameSite: http.SameSiteLaxMode,
				MaxAge: app.SessionTtlMin * 60,
			}
			http.SetCookie(ctx.Rp.Writer, cookie)
		}
		return nil
	})

	flex.WebsocketRouter.PushApi(router.Path("et/{tid}/req").AsUnresponsive(), func(c *flex.Websocket) {
		wset(c, true)
	}).PushApi(router.Path("et/{tid}/offer").AsUnresponsive(), func(c *flex.Websocket) {
		wset(c, false)
	}).PushApi(router.Path("et/{tid}/answer").AsUnresponsive(), func(c *flex.Websocket) {
		wset(c, false)
	}).PushApi(router.Path("et/{tid}/ice").AsUnresponsive(), func(c *flex.Websocket) {
		wset(c, false)
	}).SetEventHandler(func(ctx *router.Context[*flex.WebsocketProtocol]) error {
		return app.NewSession(ctx.Rp)
	}, nil)
}

func wset(c *flex.Websocket, req bool) {
	topic, err := et.FindTopic(c, c.Param("tid"))
	if err != nil {
		slog.Warn(err.Error())
		return
	}
	if err = topic.Authenticate(c.Rp.Session()); err != nil {
		slog.Warn(err.Error())
		return
	}
	if sig, ok := converter.PbRawRequester[*flex.WebsocketProtocol, *et.PbSignalling](c).Parse(); ok && sig != nil {
		if req {
			topic.Broadcast(c, sig)
		} else if sig.Receiver != nil {
			topic.SendTo(c, sig)
		}
	}
}
