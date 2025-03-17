package main

import (
	"server/api"

	"go.drunkce.com/dce/proto"
)

func main() {
	// go run . server start
	proto.CliRouter.Push("server/start", ServerStart)
	api.EasyTransferApis()

	proto.CliRoute(1)
}
