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
        const toolbarContainer = document.querySelector('#toolbar') as HTMLElement;
        
        if (!container) {
            throw new Error('Scene container element not found. Please ensure #workspace exists in the DOM.');
        }
        
        if (!toolbarContainer) {
            throw new Error('Toolbar container element not found. Please ensure #toolbar exists in the DOM.');
        }
        
        if (container.clientWidth === 0 || container.clientHeight === 0) {
            console.warn('Container has zero dimensions. Scene may not render correctly.');
        }
        
        worldUI = createWorldUI({ sceneContainer: container, toolbarContainer });
        const { viewportElement, viewportWindow, windowManager } = worldUI;

        world = new World(viewportElement);
        (window as any).world = world;
        
        worldUI.attachWorld(world);

        const updateViewportSize = () => {
            worldUI?.updateViewportSize();
        };
        updateViewportSize();
        
        // --- Render Loop ---
        let lastFrameTime = performance.now();
        const renderLoop = async (): Promise<void> => {
            if (!world || !viewportWindow || !windowManager) {
                return;
            }
            
            const currentTime = performance.now();
            const deltaTime = (currentTime - lastFrameTime) / 1000;
            lastFrameTime = currentTime;
            
            world.update(deltaTime);
            
            const bounds = viewportWindow.getBounds();
            const gizmoSize = Math.floor(0.2 * Math.min(bounds.width, bounds.height));
            await world.render(bounds.width, bounds.height, gizmoSize);
            
            requestAnimationFrame(renderLoop);
        };
        
        renderLoop();
        // -------------------

        const resizeObserver = new ResizeObserver(() => {
            updateViewportSize();
            // 调用 resizer 的 updateSize 以确保相机和渲染器尺寸同步
            const resizer = (world as any).resizer;
            if (resizer && resizer.updateSize) {
                resizer.updateSize();
            }
        });
        resizeObserver.observe(viewportWindow.getElement());
        // 同时监听 Viewport 元素本身的大小变化
        resizeObserver.observe(viewportElement);
        
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

// HMR支持：在热更新时清理并重新初始化
if (typeof import.meta !== 'undefined' && (import.meta as any).hot) {
    (import.meta as any).hot.dispose(() => {
        cleanup();
    });
    
    (import.meta as any).hot.accept(() => {
        main();
    });
}