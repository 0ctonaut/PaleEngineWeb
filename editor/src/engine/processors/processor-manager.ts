import { InputProcessor } from './input-processor';

export class ProcessorManager {
    private processors: Map<string, InputProcessor> = new Map();

    public addProcessor(name: string, processor: InputProcessor): void {
        this.processors.set(name, processor);
    }

    public getProcessor<T extends InputProcessor>(name: string): T | undefined {
        return this.processors.get(name) as T;
    }

    public removeProcessor(name: string): void {
        const processor = this.processors.get(name);
        if (processor) {
            processor.dispose();
            this.processors.delete(name);
        }
    }

    public update(deltaTime: number): void {
        for (const processor of this.processors.values()) {
            processor.update(deltaTime);
        }
    }

    public dispose(): void {
        for (const processor of this.processors.values()) {
            processor.dispose();
        }
        this.processors.clear();
    }
}
