import { createCamera } from './components/camera.js';
import { createScene } from './systems/scene.js';
import { createRenderer } from './systems/renderer.js'; 
import { createCube, createBoxHelper, createSphere } from './components/3D/cube.js';
import { createLights } from './components/light.js';
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

        this.meshes = [];       // 所有动态添加的 mesh
        this.boxHelpers = [];   // 所有 BoxHelper

        const cube = createCube();
        scene.add(cube);

        const light = createLights();
        light.position.set(10, 10, 10);
        scene.add(light);

        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        container.append(renderer.domElement);
        // renderer.render(scene, camera);

        this.animate();
    }
    addMeshWithBoxHelper() {
        const mesh = createSphere();
        const x = (Math.random() - 0.5) * 10; // -5 到 5
        const y = (Math.random() - 0.5) * 10;
        const z = (Math.random() - 0.5) * 10;
        mesh.position.set(x, y, z);
        scene.add(mesh);
        this.meshes.push(mesh);

        // 创建 BoxHelper
        const helper = createBoxHelper(mesh, 0xDC143C);
        helper.material.linewidth = 5;
        scene.add(helper);
        this.boxHelpers.push(helper);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // 每帧更新 BoxHelper
        this.boxHelpers.forEach(helper => helper.update());

        this.render();
    }

    render() {
        renderer.render(scene, camera);
    }
}

export { World };