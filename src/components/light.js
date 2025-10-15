import { DirectionalLight } from 'three';

function createLights() {
    const light = new DirectionalLight('white', 8);

    return light;
}

export { createLights };