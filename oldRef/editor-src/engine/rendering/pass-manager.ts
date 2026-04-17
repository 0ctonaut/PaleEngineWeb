import type { Scene } from 'babylonjs';
import type { Engine } from 'babylonjs';
import type { Camera } from 'babylonjs';
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

    public async render(engine: Engine, scene?: Scene, camera?: Camera): Promise<void> {
        for (const { pass } of this.passes) {
            if (pass.isEnabled()) {
                await pass.render(engine, scene, camera);
            }
        }
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