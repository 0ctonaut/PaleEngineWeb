import { World } from './engine/world';
import { Toolbar, BottomBar } from './ui';
import { ProfilerPanel } from './ui/components/profiler-panel';

let world: World | null = null;
let toolbar: Toolbar | null = null;
let bottomBar: BottomBar | null = null;

function cleanup(): void {
    // 清理旧的World实例（用于热更新）
    if (world) {
        world.dispose();
        world = null;
    }
    
    // 清理 container 中的所有 canvas 元素（防止热更新时残留）
    const container = document.querySelector('#scene-container') as HTMLElement;
    if (container) {
        // 移除所有 canvas 元素
        const canvases = container.querySelectorAll('canvas');
        canvases.forEach(canvas => {
            if (canvas.parentNode) {
                canvas.parentNode.removeChild(canvas);
            }
        });
    }
    
    // 清理UI组件
    if (toolbar) {
        const toolbarContainer = document.querySelector('#toolbar') as HTMLElement;
        if (toolbarContainer) {
            const toolbarElement = toolbar.getElement();
            if (toolbarElement && toolbarElement.parentNode) {
                toolbarElement.parentNode.removeChild(toolbarElement);
            }
        }
        toolbar = null;
    }
    
    if (bottomBar) {
        const bottomBarElement = bottomBar.getElement();
        if (bottomBarElement && bottomBarElement.parentNode) {
            bottomBarElement.parentNode.removeChild(bottomBarElement);
        }
        bottomBar = null;
    }
}

function main(): void {
    try {
        // 清理旧的实例（用于热更新）
        cleanup();
        
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
        
        // 创建新的 World 实例并赋值给全局变量（重要：用于热更新清理）
        world = new World(container);
        (window as any).world = world;
        
        // Initialize UI
        toolbar = new Toolbar(world.getCameraController());
        toolbarContainer.appendChild(toolbar.getElement());
        
        // Initialize Bottom Bar with tabs (使用 fixed 模式，标题固定在 bar 上)
        bottomBar = new BottomBar('fixed');
        const profilerPanel = new ProfilerPanel(world.getPerformanceMonitor());
        bottomBar.addTab(profilerPanel);
        document.body.appendChild(bottomBar.getElement());
        
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