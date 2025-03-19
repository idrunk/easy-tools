chcp 65001 >nul
@echo off

SET CGO_ENABLED=0
SET GOOS=linux
SET GOARCH=amd64
set target_dir=%APP_ROOT%\.ignore\bin
set go_target=%target_dir%\easy-tools
echo 正在编译go的%GOOS%/%GOARCH%平台可执行文件到%go_target% ...
go build -C "%APP_ROOT%\go" -o "%go_target%"

set next_target=%target_dir%\easy-tools-next.tgz
echo 正在编译nextjs ...
cd "%APP_ROOT%\ts"
call npm run build
echo 正在打包nextjs编译产物到%next_target% ...
xcopy /e /i /y .next\static .next\standalone\.next\static
tar -czf "%next_target%" -C".next" standalone

echo 编译打包完成，产物位于 %target_dir% 目录