import { MeshBuilder, StandardMaterial, PBRMaterial, Color3 } from 'babylonjs';
import { Layers, SelectionCategory, PaleObject } from '../engine';

export type CubeSize = number | [number, number, number];

export function createCube(
    size: CubeSize = [1, 1, 1],
    color: string = 'white',
    _layer: number = Layers.DEFAULT
): PaleObject {
    const dimensions = normalizeDimensions(size);
    const mesh = MeshBuilder.CreateBox('Cube', {
        width: dimensions[0],
        height: dimensions[1],
        depth: dimensions[2]
    });

    const material = new StandardMaterial('CubeMaterial');
    material.diffuseColor = Color3.FromHexString(color);
    mesh.material = material;

    const paleObject = new PaleObject(mesh, 'Cube');
    paleObject.tag = SelectionCategory.SCENE_OBJECT;
    return paleObject;
}

export function createSphere(
    radius: number = 1,
    segments: number = 32,
    color: string = 'white',
    _layer: number = Layers.DEFAULT
): PaleObject {
    const validRadius = radius <= 0 ? 1 : radius;
    const validSegments = segments < 3 ? 32 : segments;

    const mesh = MeshBuilder.CreateSphere('Sphere', {
        diameter: validRadius * 2,
        segments: validSegments
    });

    const material = new StandardMaterial('SphereMaterial');
    material.diffuseColor = Color3.FromHexString(color);
    mesh.material = material;

    const paleObject = new PaleObject(mesh, 'Sphere');
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
    const radius = options.radius ?? 1;
    const segments = options.segments ?? 32;
    const transmission = options.transmission ?? 0.9;
    const roughness = options.roughness ?? 0.2;
    const ior = options.ior ?? 2.0;

    const validRadius = radius <= 0 ? 1 : radius;
    const validSegments = segments < 3 ? 32 : segments;

    const mesh = MeshBuilder.CreateSphere('GlassSphere', {
        diameter: validRadius * 2,
        segments: validSegments
    });

    const material = new PBRMaterial('GlassMaterial');
    material.albedoColor = Color3.White();
    material.metallic = 0;
    material.roughness = roughness;
    material.alpha = 1 - transmission;
    material.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
    material.subSurface.isRefractionEnabled = true;
    material.subSurface.refractionIntensity = transmission;
    material.subSurface.indexOfRefraction = ior;

    mesh.material = material;

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
    const radius = options.radius ?? 1;
    const segments = options.segments ?? 32;
    const metalness = options.metalness ?? 1;
    const roughness = options.roughness ?? 0.2;

    const validRadius = radius <= 0 ? 1 : radius;
    const validSegments = segments < 3 ? 32 : segments;

    const mesh = MeshBuilder.CreateSphere('MirrorSphere', {
        diameter: validRadius * 2,
        segments: validSegments
    });

    const material = new PBRMaterial('MirrorMaterial');
    material.albedoColor = Color3.White();
    material.metallic = metalness;
    material.roughness = roughness;
    material.reflectivityColor = Color3.White();

    mesh.material = material;

    const paleObject = new PaleObject(mesh, 'MirrorSphere');
    paleObject.tag = SelectionCategory.SCENE_OBJECT;
    return paleObject;
}

function normalizeDimensions(size: CubeSize): [number, number, number] {
    if (typeof size === 'number') {
        if (size <= 0) {
            console.warn('Cube size must be positive, using default value 1');
            return [1, 1, 1];
        }
        return [size, size, size];
    }

    if (Array.isArray(size) && size.length === 3) {
        const [width, height, depth] = size;
        if (width <= 0 || height <= 0 || depth <= 0) {
            console.warn('All cube dimensions must be positive, using default values');
            return [1, 1, 1];
        }
        return [width, height, depth];
    }

    console.warn('Invalid cube size parameter, using default value [1, 1, 1]');
    return [1, 1, 1];
}