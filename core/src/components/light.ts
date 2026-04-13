import { DirectionalLight } from 'three/webgpu';
import { PaleObject } from '../engine';

export function createLights(
    color: string | number = 'white',
    intensity: number = 8
): PaleObject {
    // Parameter validation
    if (intensity < 0) {
        console.warn('Light intensity must be non-negative, using default value 8');
        intensity = 8;
    }
    
    const light = new DirectionalLight(color, intensity);
    // 包装为 PaleObject
    const paleObject = new PaleObject(light, 'DirectionalLight');
    return paleObject;
}