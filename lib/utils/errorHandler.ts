export class RateLimiter {
    private lastCall: number = 0;
    private minInterval: number;

    constructor(callsPerSecond: number) {
        this.minInterval = 1000 / callsPerSecond;
    }

    async wait(): Promise<void> {
        const now = Date.now();
        const timeSinceLastCall = now - this.lastCall;
        if (timeSinceLastCall < this.minInterval) {
            await new Promise(resolve => setTimeout(resolve, this.minInterval - timeSinceLastCall));
        }
        this.lastCall = Date.now();
    }
}


export function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}