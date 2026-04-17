import type { Scene } from 'babylonjs';
import type { Engine } from 'babylonjs';
import type { Camera } from 'babylonjs';

export interface RenderPass {
    render(engine: Engine, scene?: Scene, camera?: Camera): Promise<void>;
    setSize(width: number, height: number): void;
    dispose(): void;

    enable(): void;
    disable(): void;
    isEnabled(): boolean;

    shouldClear(): boolean;
}