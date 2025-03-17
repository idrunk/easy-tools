package app

import (
	"fmt"

	"github.com/redis/go-redis/v9"
	"go.drunkce.com/dce/proto"
	"go.drunkce.com/dce/proto/flex"
	"go.drunkce.com/dce/router"
	"go.drunkce.com/dce/session"
	"go.drunkce.com/dce/session/redises"
)

var Rdb *redis.Client

func init() {
	conf := ConfOrInit()
	redisAddr := fmt.Sprintf("%s:%d", conf.Redis.Host, conf.Redis.Port)
	Rdb = redis.NewClient(&redis.Options{Addr: redisAddr, DB: conf.Redis.Db})
}

const SessionTtlMin = 1440

func NewSession(rp router.RoutableProtocol) error {
	sid := rp.Sid()
	if ws, ok := rp.(*flex.WebsocketProtocol); ok {
		sid = proto.NewHttpProtocol(nil, ws.Req).Sid()
	}
	sess, err := redises.NewSession[session.SimpleUser](Rdb, []string{sid}, SessionTtlMin)
	if err == nil {
		rp.SetSession(sess)
	}
	return err
}