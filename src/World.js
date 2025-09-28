import { createCamera } from './components/camera.js';
import { createCube } from './components/3D/cube.js';
import { createScene } from './systems/scene.js';
import { createRenderer } from './systems/renderer.js'; 
import { Resizer } from './systems/Resizer.js';

let camera;
let renderer;
let scene;

class World {
    constructor(container) {
        camera = createCamera();
        scene = createScene();
        renderer = createRenderer();
        const resizer = new Resizer(container, camera, renderer);

        const cube = createCube();
        scene.add(cube);

        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        container.append(renderer.domElement);
        renderer.render(scene, camera);

        container.append(renderer.domElement);
    }

    render() {
        renderer.render(scene, camera);
    }
}

export { World };