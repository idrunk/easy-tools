经常在没有微信或者微信等不便登录的环境需要传输信息，于是就想做个工具解决这个问题。这个工具应该是方便的、免安装的，应该基于浏览器实现。但不想用纯BS架构，因为这会增加硬件成本、有隐私安全问题等。WebRTC技术可以解决这些问题，让数据免经服务器传输，也无需考虑带宽等硬件成本问题，所以想用来实现这个工具。

14年年底找工作发现Golang很热，前端方面也有很多React的需求，自己本来也对它们很感兴趣，所以就想学习起来。刷了一遍官方文档、看了些三方资料后，想写点东西来练手，于是先写了[dce-go](https://github.com/idrunk/dce-go)来练习Golang，然后又基于`dce-go`与`nextjs`写了这个工具来练习React。

所以，这是一个练手项目，大概会长期维护，但不保证更新频率。如果你对此项目感兴趣，欢迎贡献代码，以推动其更好的发展。

## TODO

1. 解决文件发送可能中断的问题
2. 支持文件传输进度展示
3. 尝试JS层优化文件传输效率
4. 视频云播支持？
5. 音视频通话支持？
6. 设计实现基于WebRTC的类因特网架构，以支持无限量会话用户？（构思了很久，也许会尝试做，也许不会，也许会闭源）