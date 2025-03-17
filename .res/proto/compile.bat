@echo off

protoc --go_out=%APP_ROOT%\go\lib --proto_path=%APP_ROOT%\.res\proto %APP_ROOT%\.res\proto\*.go.proto
protoc --ts_out=%APP_ROOT%\ts\lib\model\et --proto_path=%APP_ROOT%\.res\proto %APP_ROOT%\.res\proto\et*.proto
