import { WebGPURenderer, Scene, Camera } from 'three/webgpu';
import { RenderPass } from './pass';

export class PassManager {
    private passes: Array<{ name: string; pass: RenderPass }> = [];
    private width: number = 0;
    private height: number = 0;

    public addPass(name: string, pass: RenderPass): void {
        const index = this.passes.findIndex(p => p.name === name);
        if (index >= 0) {
            this.passes[index].pass.dispose();
            this.passes[index].pass = pass;
        } else {
            this.passes.push({ name, pass });
        }

        if (this.width > 0 && this.height > 0) {
            pass.setSize(this.width, this.height);
        }
    }

    public removePass(name: string): void {
        const index = this.passes.findIndex(p => p.name === name);
        if (index >= 0) {
            this.passes[index].pass.dispose();
            this.passes.splice(index, 1);
        }
    }

    public getPass(name: string): RenderPass | undefined {
        const entry = this.passes.find(p => p.name === name);
        return entry?.pass;
    }

    public enablePass(name: string): void {
        const entry = this.passes.find(p => p.name === name);
        if (entry) {
            entry.pass.enable();
        }
    }

    public disablePass(name: string): void {
        const entry = this.passes.find(p => p.name === name);
        if (entry) {
            entry.pass.disable();
        }
    }

    public async render(renderer: WebGPURenderer, scene?: Scene, camera?: Camera): Promise<void> {
        renderer.setClearColor(0x000000, 0.0);
        const originalAutoClearColor = renderer.autoClearColor;
        
        for (const { pass } of this.passes) {
            if (pass.isEnabled()) {
                renderer.autoClearColor = pass.shouldClear();
                await pass.render(renderer, scene, camera);
            }
        }
        renderer.autoClearColor = originalAutoClearColor;
    }

    public setSize(width: number, height: number): void {
        this.width = width;
        this.height = height;
        
        for (const { pass } of this.passes) {
            pass.setSize(width, height);
        }
    }

    public dispose(): void {
        for (const { pass } of this.passes) {
            pass.dispose();
        }
        this.passes = [];
    }

    public getPassNames(): string[] {
        return this.passes.map(p => p.name);
    }
}

