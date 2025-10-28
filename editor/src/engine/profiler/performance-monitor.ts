export interface PerformanceData {
    timestamp: number;
    fps: number;
    memory: number; // in bytes, or -1 if unavailable
}

export class PerformanceMonitor {
    private dataQueue: PerformanceData[] = [];
    private maxDataPoints = 120; // 30s * 4 times/s
    
    private lastFrameTime: number = 0;
    private accumFrameCnt: number = 0;
    private lastSampleTime: number = 0;
    private sampleInterval: number = 250; // 1000ms / 4
    
    private subscribers: Set<(data: PerformanceData) => void> = new Set();
    
    constructor() {
        this.lastFrameTime = performance.now();
        this.lastSampleTime = this.lastFrameTime;
    }
    
    public update(): void {
        const currentTime = performance.now();
        this.lastFrameTime = currentTime;
        this.accumFrameCnt++;
        
        const timeSinceLastSample = currentTime - this.lastSampleTime;
        if (timeSinceLastSample >= this.sampleInterval) {
            this.sampleData(currentTime);
            this.lastSampleTime = currentTime;
        }
    }
    
    private sampleData(currentTime: number): void {
        // FPS
        const actualDelta = currentTime - this.lastSampleTime;
        const fps = actualDelta > 0 ? (1000 / (actualDelta / this.accumFrameCnt)) : 0;
        this.accumFrameCnt = 0;
        
        // Mem
        let memory = -1;
        if (this.isMemoryAvailable()) {
            const memoryInfo = (performance as any).memory;
            memory = memoryInfo.usedJSHeapSize;
        }
        
        const data: PerformanceData = {
            timestamp: currentTime,
            fps,
            memory
        };
        
        this.dataQueue.push(data);
        if (this.dataQueue.length > this.maxDataPoints) {
            this.dataQueue.shift();
        }
        
        this.notifySubscribers(data);
    }
    
    private isMemoryAvailable(): boolean {
        return (performance as any).memory !== undefined;
    }
    
    public subscribe(callback: (data: PerformanceData) => void): () => void {
        this.subscribers.add(callback);
        return () => {
            this.subscribers.delete(callback);
        };
    }
    
    private notifySubscribers(data: PerformanceData): void {
        for (const callback of this.subscribers) {
            callback(data);
        }
    }
    
    public getData(): PerformanceData[] {
        return [...this.dataQueue];
    }
    
    public getStatistics(): {
        current: PerformanceData | null;
        avgFps: number;
        avgMemory: number;
        minFps: number;
        maxFps: number;
        minMemory: number;
        maxMemory: number;
    } {
        if (this.dataQueue.length === 0) {
            return {
                current: null,
                avgFps: 0,
                avgMemory: 0,
                minFps: 0,
                maxFps: 0,
                minMemory: 0,
                maxMemory: 0
            };
        }
        
        const current = this.dataQueue[this.dataQueue.length - 1];
        const fpsValues = this.dataQueue.map(d => d.fps);
        const memoryValues = this.dataQueue.map(d => d.memory).filter(m => m > 0);
        
        const avgFps = fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length;
        const avgMemory = memoryValues.length > 0? memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length : 0;
        
        return {
            current,
            avgFps,
            avgMemory,
            minFps: Math.min(...fpsValues),
            maxFps: Math.max(...fpsValues),
            minMemory: memoryValues.length > 0 ? Math.min(...memoryValues) : 0,
            maxMemory: memoryValues.length > 0 ? Math.max(...memoryValues) : 0
        };
    }
    
    public clear(): void {
        this.dataQueue = [];
    }
    
    public isMemoryMonitoringAvailable(): boolean {
        return this.isMemoryAvailable();
    }
}
