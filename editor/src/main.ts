import { World } from './engine';
import { createWorldUI, WorldUI } from './ui/worldUI';

let world: World | null = null;
let worldUI: WorldUI | null = null;

function cleanup(): void {
    if (world) {
        world.dispose();
        world = null;
    }

    if (worldUI) {
        worldUI.dispose();
        worldUI = null;
    }
}

function main(): void {
    try {
        cleanup();

        const container = document.querySelector('#workspace') as HTMLElement;

        if (!container) {
            throw new Error('Scene container element not found. Please ensure #workspace exists in the DOM.');
        }

        if (container.clientWidth === 0 || container.clientHeight === 0) {
            console.warn('Container has zero dimensions. Scene may not render correctly.');
        }

        worldUI = createWorldUI({ workspaceContainer: container });

        world = new World(container);
        (window as any).world = world;

        (window as any).attachWorld(world);

        world.animate();

        console.log('PaleEngine Editor initialized successfully');

    } catch (error) {
        console.error('Failed to initialize PaleEngine Editor:', error);

        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #ff4444;
            color: white;
            padding: 20px;
            border-radius: 8px;
            font-family: Arial, sans-serif;
            z-index: 1000;
        `;
        errorDiv.textContent = `Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        document.body.appendChild(errorDiv);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}

if (typeof import.meta !== 'undefined' && (import.meta as any).hot) {
    (import.meta as any).hot.dispose(() => {
        cleanup();
    });

    (import.meta as any).hot.accept(() => {
        main();
    });
}