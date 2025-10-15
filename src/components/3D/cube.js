import { 
    BoxGeometry, SphereGeometry, Mesh, 
    MeshBasicMaterial, MeshStandardMaterial, 
    BoxHelper
} from 'three';

function createCube() {
    const geometry = new BoxGeometry(2, 2, 2);
    const spec = {
        color: 'purple',
    };
    const material = new MeshStandardMaterial(spec);
    const cube = new Mesh(geometry, material);
    return cube;
}

function createSphere() {
    const geometry = new SphereGeometry(1, 32, 32);
    const spec = {
        color: 'orange',
    };
    const material = new MeshStandardMaterial(spec);
    const sphere = new Mesh(geometry, material);
    return sphere;
}

function createBoxHelper(mesh, color) {
    const helper = new BoxHelper(mesh, color);
    return helper;
}

export { createCube, createBoxHelper, createSphere };