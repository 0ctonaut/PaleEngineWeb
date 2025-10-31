import { WebGPURenderer, Scene, Camera } from 'three/webgpu';

export interface RenderPass {
    render(renderer: WebGPURenderer, scene?: Scene, camera?: Camera): Promise<void>;
    setSize(width: number, height: number): void;
    dispose(): void;
    
    enable(): void;
    disable(): void;
    isEnabled(): boolean;
}

