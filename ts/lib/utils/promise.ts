export default class TimePromise {
    constructor(
        public data: any, // 附带数据，可在实现承诺时按需调取
        private channel: string,
        private id: string,
        private createTime: number,
        private timerId: number,
        private resolver: (value: any) => void,
        private rejecter?: (error: string) => void,
    ) {}

    private static timeoutTip = 'Promise timeout.'

    private static resolveMapping: {[index: string]: {
        lastResolvedCreateTime: number
        tasks: { [index: string]: TimePromise },
    }} = {}

    private static pushTask(
        channel: string, id: string, data: any,
        resolver: (value: any) => void,
        rejecter?: (error: string) => void,
    ): TimePromise {
        if (! Reflect.has(this.resolveMapping, channel)) this.resolveMapping[channel] = {
            lastResolvedCreateTime: 0,
            tasks: {},
        };
        const task = new TimePromise(data, channel, id, new Date().getTime(), 0, resolver, rejecter);
        this.resolveMapping[channel].tasks[id] = task;
        return task;
    }

    private static removeTask(task: TimePromise): void {
        delete this.resolveMapping[task.channel].tasks[task.id];
    }

    private static deliverTask(task: TimePromise, data: any): void {
        this.resolveMapping[task.channel].lastResolvedCreateTime = task.createTime;
        task.resolver(data);
    }

    /**
     * 新建一个承诺
     * @param taskSupplier 时效承诺生成器
     * @param timeout 超时时间（微秒）
     * @param timeoutTip 
     * @returns 
     */
    private static new(
        taskSupplier: (resolver: (value: any) => void, rejecter?: (error: string) => void) => TimePromise,
        timeout: number = 0,
        timeoutTip: string|((resumed?: boolean) => string) = this.timeoutTip,
    ): Promise<any> {
        return new Promise((resolve, reject) => {
            const close = (complete: (data: any) => void, data: any, overtime = false) => {
                ! overtime && task?.clearTimeout();
                complete(data); // 实际的`resolve`或`reject`调用
                task?.channel && this.removeTask(task);
            }
            // 绑定`resolve`与`reject`生成`TimePromise`以便手动回调兑现或拒绝承诺
            const task = taskSupplier((value: any) => close(resolve, value), (error: string) => close(reject, error));
            // 若未指定超时时长，则为普通承诺，否则为时效承诺，注册超时处理机制
            task.timerId = timeout < 1 ? 0 : setTimeout(() => {
                const tipFormat = (t: any) => typeof t === 'string' ? t.replace('{{timeout}}', String(timeout / 1000)) : t;
                const tip = tipFormat(typeof timeoutTip !== 'function' ? timeoutTip
                    : timeoutTip(!! task?.channel && task?.createTime <= this.resolveMapping[task.channel].lastResolvedCreateTime));
                close(reject, tip, true);
            }, timeout) as any as number;
        })
    }

    /**
     * 注册一个时效承诺
     * @param channel       承诺的映射通道名
     * @param id            承诺ID，作为兑现回调的映射键
     * @param timeout       承诺超时时间（微秒），`0`表示普通承诺，永不超时
     * @param timeoutTip    承诺超时提示，若为函数，则将在超时时调用，取其返回值作为毁诺入参，否则直接作入参
     * @param data          附带数据，可在实现承诺时按需调取
     * @returns 返回时效承诺
     */
    public static register<T>(
        channel: string,
        id: string,
        timeout: number = 0,
        timeoutTip: string|((resumed?: boolean) => string) = TimePromise.timeoutTip,
        data?: any,
    ): Promise<T> {
        const pusher = TimePromise.pushTask.bind(TimePromise, channel, id, data);
        return TimePromise.new(pusher, timeout, timeoutTip);
    }

    /**
     * 从指定通道以ID取一个承诺
     * @param channel 承诺映射通道名
     * @param id 承诺ID
     * @returns 取到则返回承诺，否则返回undefined
     */
    public static get(channel: string, id: string): TimePromise {
        return TimePromise.resolveMapping?.[channel]?.tasks?.[id];
    }

    // 兑现一个承诺
    public resolve(data?: any): void {
        TimePromise.deliverTask(this, data);
    }

    // 拒绝一个承诺
    public reject(error: string): void {
        this.rejecter && this.rejecter(error);
    }

    // 清除超时倒计时
    public clearTimeout(): void {
        this.timerId > 0 && clearTimeout(this.timerId);
    }
}