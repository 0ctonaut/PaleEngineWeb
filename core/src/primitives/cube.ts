import {
    BoxGeometry,
    SphereGeometry,
    Mesh,
    MeshStandardMaterial,
    MeshPhysicalMaterial
} from 'three/webgpu';
import { Layers, SelectionCategory, PaleObject } from '../engine';


export type CubeSize = number | [number, number, number];

export function createCube(
    size: CubeSize = [1, 1, 1], 
    color: string = 'white',
    layer: number = Layers.DEFAULT
): PaleObject {
    const dimensions = _normalizeDimensions(size);
    const geometry = new BoxGeometry(...dimensions);
    const material = new MeshStandardMaterial({ color });
    const mesh = new Mesh(geometry, material);
    
    // Set rendering layer
    mesh.layers.set(layer);
    
    // 包装为 PaleObject
    const paleObject = new PaleObject(mesh, 'Cube');
    // 设置 tag
    paleObject.tag = SelectionCategory.SCENE_OBJECT;
    return paleObject;
}

export function createSphere(
    radius: number = 1,
    segments: number = 32,
    color: string = 'white',
    layer: number = Layers.DEFAULT
): PaleObject {
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
    
    // 包装为 PaleObject
    const paleObject = new PaleObject(mesh, 'Sphere');
    // 设置 tag
    paleObject.tag = SelectionCategory.SCENE_OBJECT;
    return paleObject;
}

export interface GlassSphereOptions {
    radius?: number;
    segments?: number;
    transmission?: number;
    thickness?: number;
    roughness?: number;
    ior?: number;
    layer?: number;
}

export function createGlassSphere(options: GlassSphereOptions = {}): PaleObject {
    let {
        radius = 1,
        segments = 256,
        transmission = 0.9,
        thickness = 0.1,
        roughness = 0.2,
        ior = 2.0,
        layer = Layers.DEFAULT
    } = options;

    if (radius <= 0) {
        console.warn('Sphere radius must be positive, using default value 1');
        radius = 1;
    }

    if (segments < 3) {
        console.warn('Sphere segments must be at least 3, using default value 32');
        segments = 256;
    }

    const geometry = new SphereGeometry(radius, segments, segments);
    const material = new MeshPhysicalMaterial({
        color: 0xffffff,
        transmission: transmission,
        thickness: thickness,
        roughness: roughness,
        ior: ior,
        transparent: true,
        opacity: 1
    });
    const mesh = new Mesh(geometry, material);

    mesh.layers.set(layer);

    const paleObject = new PaleObject(mesh, 'GlassSphere');
    paleObject.tag = SelectionCategory.SCENE_OBJECT;
    return paleObject;
}

export interface MirrorSphereOptions {
    radius?: number;
    segments?: number;
    metalness?: number;
    roughness?: number;
    reflectivity?: number;
    layer?: number;
}

export function createMirrorSphere(options: MirrorSphereOptions = {}): PaleObject {
    let {
        radius = 1,
        segments = 256,
        metalness = 1,
        roughness = 0.2,
        reflectivity = 1,
        layer = Layers.DEFAULT
    } = options;

    if (radius <= 0) {
        console.warn('Sphere radius must be positive, using default value 1');
        radius = 1;
    }

    if (segments < 3) {
        console.warn('Sphere segments must be at least 3, using default value 128');
        segments = 256;
    }

    const geometry = new SphereGeometry(radius, segments, segments);
    const material = new MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: metalness,
        roughness: roughness,
        reflectivity: reflectivity,
        clearcoat: 1,
        clearcoatRoughness: 0
    });
    const mesh = new Mesh(geometry, material);

    mesh.layers.set(layer);

    const paleObject = new PaleObject(mesh, 'MirrorSphere');
    paleObject.tag = SelectionCategory.SCENE_OBJECT;
    return paleObject;
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