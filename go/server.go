package main

import (
	"context"
	"fmt"
	"log"
	"log/slog"
	"net"
	"net/http"
	"os"
	"server/lib/app"
	"strings"

	"github.com/coder/websocket"
	"go.drunkce.com/dce/proto"
	"go.drunkce.com/dce/proto/flex"
)

type ContextKey string

func ServerStart(c *proto.Cli) {
	logLevel := strings.ToLower(c.Rp.ArgOr("--log-level", "info"))
	logMap := map[string]slog.Level {
		"debug": slog.LevelDebug,
		"info": slog.LevelInfo,
		"warn": slog.LevelWarn,
		"error": slog.LevelError,
	}
	level, ok := logMap[logLevel]
	if !ok {
		level = slog.LevelInfo
	}
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: level,
	})))

	addr := fmt.Sprintf("%s:%d", app.Conf.Host, app.Conf.Port)
	bindWebsocket()
	server := &http.Server{
		Addr: addr,
		ConnContext: func(ctx context.Context, c net.Conn) context.Context {
			if tcpConn, ok := c.(*net.TCPConn); ok {
				localAddr := tcpConn.LocalAddr().(*net.TCPAddr)
				ctx = context.WithValue(ctx, ContextKey("localIP"), localAddr.IP.String())
			}
			return ctx
		},
		Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "http://192.168.1.222:3000")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			proto.HttpRouter.Route(w, r)
		}),
	}
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("FlexWebsocket server is starting on %s\n", addr)
	server.Serve(listener)
}

func bindWebsocket() {
	proto.HttpRouter.Get("ws", func(h *proto.Http) {
		c, err := websocket.Accept(h.Rp.Writer, h.Rp.Req, &websocket.AcceptOptions{
			OriginPatterns: app.Conf.Cors,
		})
		if err != nil {
			slog.Warn(err.Error())
			return
		}
		flex.WebsocketRouter.SetMapping(h.Rp.Req.RemoteAddr, c)
		defer flex.WebsocketRouter.Unmapping(h.Rp.Req.RemoteAddr)
		for {
			if !flex.WebsocketRouter.Route(c, h.Rp.Req, nil) {
				break
			}
		}
		_ = c.Close(websocket.StatusNormalClosure, "")
	})

	flex.WebsocketRouter.Push("ping", func(w *flex.Websocket) {})
}