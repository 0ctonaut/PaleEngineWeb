import{
  World
} from "./World.js"

function main() {
    const container = document.querySelector('#scene-container');
    const world = new World(container);
    const button = document.getElementById('add-btn');
        button.addEventListener('click', () => {
        world.addMeshWithBoxHelper();
    });
    world.animate();
}

main();