export function formatBytes(bytes?: number, decimals: number = 2): string {
    if (! bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['B', 'K', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + sizes[i];
}

export class TimeId {
    private static randWidth = BigInt(16);
    private static randMask = (BigInt(1) << this.randWidth) - BigInt(1);
    private static randUpperBoundary = Number(this.randMask) + 1;
    private static timeFactorWidth = 48;
    private static timeFactorMask = (BigInt(1) << BigInt(this.timeFactorWidth)) - BigInt(1);

    private time: Date;
    private randPart: bigint;
    private constructor(private radix: number, time?: Date, randPart?: bigint) {
        this.time = time || new Date;
        this.randPart = typeof randPart === "number" ? randPart & TimeId.randMask : BigInt(Math.floor(Math.random() * TimeId.randUpperBoundary));
    }

    public getTime(): Date {
        return this.time;
    }

    public toBigInt(): BigInt {
        return ((BigInt(this.time.getTime()) & TimeId.timeFactorMask) << TimeId.randWidth) + this.randPart;
    }

    public toString(): string {
        return this.toBigInt().toString(this.radix);
    }

    public static get get(): string {
        return this.new().toString();
    }

    public static new(radix: number = 36): TimeId {
        return new TimeId(radix);
    }

    public static parseInt(id: number, radix: number = 36): TimeId {
        const bigintId = BigInt(id);
        const timeFactorMask = (bigintId >> this.randWidth) ^ this.timeFactorMask;
        return new TimeId(radix, new Date(Number((BigInt(new Date().getTime()) | this.timeFactorMask) ^ timeFactorMask)), bigintId);
    }

    public static parse(id: string, radix: number = 36): TimeId {
        return this.parseInt(parseInt(id, radix), radix);
    }
}

export function sortDeduplicateMergeTo<T>(arr: T[], batch: T[], comparer?: (arrItem: T, batchItem: T) => number) {
    !comparer && (comparer = (arrItem, batchItem) => arrItem < batchItem ? -1 : Number(arrItem > batchItem));
    arr.length += batch.length;
    let i = arr.length - batch.length - 1;
    let j = batch.length - 1;
    let insertPos = arr.length - 1;
    while (j >= 0) {
        const result = i < 0 ? -1 : comparer(arr[i], batch[j]);
        if (result < 0) {
            arr[insertPos] = batch[j--];
        } else if (i >= 0) {
            if (result > 0) {
                arr[insertPos] = arr[i--];
            } else {
                arr[insertPos] = arr[i--];
                j--;
            }
        }
        if (insertPos < arr.length - 1 && arr[insertPos] === arr[insertPos + 1]) {
            continue;
        }
        insertPos --;
    }
    while (i >= 0) {
        arr[insertPos --] = arr[i --];
    }
    arr.splice(0, insertPos + 1);
}

export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number = 200,
) {
    let timeout: ReturnType<typeof setTimeout>;
    return function (this: any, ...args: Parameters<T>) {
        const context = this as any;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(context, args);
        }, wait)
    };
}