import consola from "consola";

/*
Consola only shows logs with configured log level or below. (Default is 3)

Available log levels:

0: Fatal and Error
1: Warnings
2: Normal logs
3: Informational logs, success, fail, ready, start, ...
4: Debug logs
5: Trace logs
-999: Silent
+999: Verbose logs
*/

const logLevel = process.env.NEXT_PUBLIC_LOG_LEVEL ?? 'info';

const level = {
    error: 0,
    warn: 1,
    normal: 2,
    info: 3,
    debug: 4,
    trace: 5,
}[logLevel] ?? 3;

const log = consola.create({ level });

export default log;