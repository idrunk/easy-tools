module server

go 1.23.3

require github.com/coder/websocket v1.8.12

require (
	github.com/cespare/xxhash/v2 v2.2.0 // indirect
	github.com/dgryski/go-rendezvous v0.0.0-20200823014737-9f7001d12a5f // indirect
	golang.org/x/sync v0.8.0 // indirect
)

require (
	dario.cat/mergo v1.0.1
	github.com/go-task/slim-sprig v0.0.0-20230315185526-52ccab3ef572 // indirect
	github.com/google/pprof v0.0.0-20210407192527-94a9f03dee38 // indirect
	github.com/onsi/ginkgo/v2 v2.9.5 // indirect
	github.com/pelletier/go-toml/v2 v2.2.3
	github.com/quic-go/quic-go v0.49.0 // indirect
	github.com/redis/go-redis/v9 v9.7.0
	go.drunkce.com/dce v0.1.1
	go.uber.org/mock v0.5.0 // indirect
	golang.org/x/crypto v0.26.0 // indirect
	golang.org/x/exp v0.0.0-20240506185415-9bf2ced13842 // indirect
	golang.org/x/mod v0.18.0 // indirect
	golang.org/x/net v0.28.0 // indirect
	golang.org/x/sys v0.23.0 // indirect
	golang.org/x/tools v0.22.0 // indirect
	google.golang.org/protobuf v1.36.5
)

replace go.drunkce.com/dce => ../../dce/backend/dce-go
