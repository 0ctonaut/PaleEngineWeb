import { WebGPUEngine } from 'babylonjs';

export interface RendererOptions {
    antialias?: boolean;
    preserveDrawingBuffer?: boolean;
    stencil?: boolean;
}

export async function createRenderer(
    canvas: HTMLCanvasElement,
    options?: RendererOptions
): Promise<WebGPUEngine> {
    const engine = new WebGPUEngine(canvas, {
        antialias: options?.antialias ?? true,
        preserveDrawingBuffer: options?.preserveDrawingBuffer ?? true,
        stencil: options?.stencil ?? true,
        adaptToDeviceRatio: true,
    });

    await engine.initAsync();

    return engine;
}