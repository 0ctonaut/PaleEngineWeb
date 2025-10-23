import { Color, Scene } from 'three/webgpu';


export function createScene(backgroundColor: string | number = 'dimgray'): Scene {
    const scene = new Scene();
    scene.background = new Color(backgroundColor);
    return scene;
}