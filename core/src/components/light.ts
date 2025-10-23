import { DirectionalLight } from 'three/webgpu';

export function createLights(
    color: string | number = 'white',
    intensity: number = 8
): DirectionalLight {
    // Parameter validation
    if (intensity < 0) {
        console.warn('Light intensity must be non-negative, using default value 8');
        intensity = 8;
    }
    
    return new DirectionalLight(color, intensity);
}