import { World } from './engine/world';
import { Toolbar } from './ui';

function main(): void {
    try {
        const container = document.querySelector('#scene-container') as HTMLElement;
        const toolbarContainer = document.querySelector('#toolbar') as HTMLElement;
        
        if (!container) {
            throw new Error('Scene container element not found. Please ensure #scene-container exists in the DOM.');
        }
        
        if (!toolbarContainer) {
            throw new Error('Toolbar container element not found. Please ensure #toolbar exists in the DOM.');
        }
        
        if (container.clientWidth === 0 || container.clientHeight === 0) {
            console.warn('Container has zero dimensions. Scene may not render correctly.');
        }
        
        const world = new World(container);
        (window as any).world = world;
        
        // Initialize UI
        const toolbar = new Toolbar(world.getCameraController());
        toolbarContainer.appendChild(toolbar.getElement());
        
        console.log('PaleEngine Editor initialized successfully');
        
    } catch (error) {
        console.error('Failed to initialize PaleEngine Editor:', error);
        
        // Display user-friendly error message
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

// Wait for DOM to load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}