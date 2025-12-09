import { PerspectiveCamera } from 'three/webgpu';

export type CameraPosition = [number, number, number];

export function createCamera(
    fov: number = 75,
    aspect: number = 1,
    near: number = 0.1,
    far: number = 100000,
    position: CameraPosition = [0, 0, 10]
): PerspectiveCamera {
    // Parameter validation
    if (fov <= 0 || fov >= 180) {
        console.warn('FOV must be between 0 and 180 degrees, using default value 75');
        fov = 75;
    }
    
    if (near <= 0 || near >= far) {
        console.warn('Near plane must be positive and less than far plane, using default values');
        near = 0.1;
        far = 1000;
    }
    
    const camera = new PerspectiveCamera(fov, aspect, near, far);
    camera.position.set(...position);
    return camera;
}