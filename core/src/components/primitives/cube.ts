import { 
    BoxGeometry, 
    SphereGeometry, 
    Mesh, 
    MeshStandardMaterial 
} from 'three/webgpu';
import { Layers, SelectionCategory } from '../../engine';


export type CubeSize = number | [number, number, number];

export function createCube(
    size: CubeSize = [1, 1, 1], 
    color: string = 'white',
    layer: number = Layers.DEFAULT
): Mesh {
    const dimensions = _normalizeDimensions(size);
    const geometry = new BoxGeometry(...dimensions);
    const material = new MeshStandardMaterial({ color });
    const mesh = new Mesh(geometry, material);
    
    // Set rendering layer
    mesh.layers.set(layer);
    
    // Mark as selectable scene object
    mesh.userData.selectionCategory = SelectionCategory.SCENE_OBJECT;
    
    return mesh;
}

export function createSphere(
    radius: number = 1,
    segments: number = 32,
    color: string = 'white',
    layer: number = Layers.DEFAULT
): Mesh {
    // Parameter validation
    if (radius <= 0) {
        console.warn('Sphere radius must be positive, using default value 1');
        radius = 1;
    }
    
    if (segments < 3) {
        console.warn('Sphere segments must be at least 3, using default value 32');
        segments = 32;
    }
    
    const geometry = new SphereGeometry(radius, segments, segments);
    const material = new MeshStandardMaterial({ color });
    const mesh = new Mesh(geometry, material);
    
    // Set rendering layer
    mesh.layers.set(layer);
    
    // Mark as selectable scene object
    mesh.userData.selectionCategory = SelectionCategory.SCENE_OBJECT;
    
    return mesh;
}

function _normalizeDimensions(size: CubeSize): [number, number, number] {
    if (typeof size === 'number') {
        // Validate number parameter
        if (size <= 0) {
            console.warn('Cube size must be positive, using default value 1');
            return [1, 1, 1];
        }
        return [size, size, size];
    }
    
    if (Array.isArray(size) && size.length === 3) {
        // Validate array parameter
        const [width, height, depth] = size;
        if (width <= 0 || height <= 0 || depth <= 0) {
            console.warn('All cube dimensions must be positive, using default values');
            return [1, 1, 1];
        }
        return [width, height, depth];
    }
    
    // Invalid input, use default value
    console.warn('Invalid cube size parameter, using default value [1, 1, 1]');
    return [1, 1, 1];
}