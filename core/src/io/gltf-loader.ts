import { GLTFLoader as ThreeGLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Object3D, AnimationClip } from 'three/webgpu';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Load a GLB model from the given URL
 *
 * @param url - The URL or path to the GLB file
 * @param onProgress - Optional progress callback function
 * @returns A Promise that resolves to the loaded Object3D (the scene root)
 * @throws Rejects with an error if loading fails
 */
export function loadGLB(
    url: string,
    onProgress?: (progress: ProgressEvent) => void
): Promise<Object3D> {
    const loader = new ThreeGLTFLoader();
    
    return new Promise((resolve, reject) => {
        loader.load(
            url,
            (gltf) => {
                // Return the scene root (Object3D)
                resolve(gltf.scene);
            },
            onProgress,
            (error) => {
                reject(error);
            }
        );
    });
}

/**
 * Load result containing scene and animations
 */
export interface GLBLoadResult {
    scene: Object3D;
    animations: AnimationClip[];
}

/**
 * Load a GLB model with animations from the given URL
 *
 * @param url - The URL or path to the GLB file
 * @param onProgress - Optional progress callback function
 * @returns A Promise that resolves to an object containing the scene root and animations array
 * @throws Rejects with an error if loading fails
 */
export function loadGLBWithAnimations(
    url: string,
    onProgress?: (progress: ProgressEvent) => void
): Promise<GLBLoadResult> {
    const loader = new ThreeGLTFLoader();
    
    return new Promise((resolve, reject) => {
        loader.load(
            url,
            (gltf: GLTF) => {
                resolve({
                    scene: gltf.scene,
                    animations: gltf.animations
                });
            },
            onProgress,
            (error) => {
                reject(error);
            }
        );
    });
}
