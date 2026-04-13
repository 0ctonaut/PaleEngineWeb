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
        const bottombarContainer = document.querySelector('#bottombar') as HTMLElement;
        
        if (!container) {
            throw new Error('Scene container element not found. Please ensure #workspace exists in the DOM.');
        }
        
        if (!toolbarContainer) {
            throw new Error('Toolbar container element not found. Please ensure #toolbar exists in the DOM.');
        }
        
        if (!bottombarContainer) {
            throw new Error('BottomBar container element not found. Please ensure #bottombar exists in the DOM.');
        }
        
        if (container.clientWidth === 0 || container.clientHeight === 0) {
            console.warn('Container has zero dimensions. Scene may not render correctly.');
        }
        
        worldUI = createWorldUI({ workspaceContainer: container, toolbarContainer, bottombarContainer });
        const { viewportElement, gameViewportElement, windowManager } = worldUI;

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
            if (!world || !windowManager) {
                return;
            }
            
            const currentTime = performance.now();
            const deltaTime = (currentTime - lastFrameTime) / 1000;
            lastFrameTime = currentTime;
            
            world.update(deltaTime);
            
            // Update UI components
            if (worldUI) {
                worldUI.update();
            }
            
            // 渲染 Scene viewport
            const sceneBounds = viewportElement.getBoundingClientRect();
            const sceneWidth = Math.max(sceneBounds.width, 1);
            const sceneHeight = Math.max(sceneBounds.height, 1);
            const gizmoSize = Math.floor(0.2 * Math.min(sceneWidth, sceneHeight));
            await world.render(sceneWidth, sceneHeight, gizmoSize, false);
            
            // 渲染 Game viewport（使用 MainCamera）
            const gameBounds = gameViewportElement.getBoundingClientRect();
            const gameWidth = Math.max(gameBounds.width, 1);
            const gameHeight = Math.max(gameBounds.height, 1);
            await world.render(gameWidth, gameHeight, undefined, true);
            
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
        resizeObserver.observe(viewportElement);
        resizeObserver.observe(gameViewportElement);
        
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