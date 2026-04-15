import { Scene, Camera } from 'three/webgpu';
import { Renderer } from './renderer';

export interface RenderPass {
    render(renderer: Renderer, scene?: Scene, camera?: Camera): Promise<void>;
    setSize(width: number, height: number): void;
    dispose(): void;

    enable(): void;
    disable(): void;
    isEnabled(): boolean;

    /**
     * Returns whether this pass should clear the framebuffer
     * @returns true to clear framebuffer, false to composite onto existing content
     */
    shouldClear(): boolean;
}
