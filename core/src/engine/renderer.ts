import { WebGPURenderer } from 'three/webgpu';

export interface RendererOptions {
    antialias?: boolean;
    alpha?: boolean;
    powerPreference?: 'high-performance' | 'low-power';
    forceWebGL?: boolean;
}

export function createRenderer(options?: RendererOptions): WebGPURenderer {
    const renderer = new WebGPURenderer({
        antialias: options?.antialias,
        alpha: options?.alpha,
        powerPreference: options?.powerPreference,
        forceWebGL: options?.forceWebGL
    });

    renderer.setSize(800, 600);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    return renderer;
}