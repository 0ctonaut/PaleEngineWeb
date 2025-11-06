import { World } from './engine/world';
import { Toolbar, WindowManager, Viewport, WindowDragHandler, WindowResizeHandler, WindowContextMenu, ProfilerPanel } from './ui';

let world: World | null = null;
let toolbar: Toolbar | null = null;
let windowManager: WindowManager | null = null;
let dragHandler: WindowDragHandler | null = null;
let resizeHandler: WindowResizeHandler | null = null;
let contextMenu: WindowContextMenu | null = null;

function cleanup(): void {
    // 清理旧的World实例（用于热更新）
    if (world) {
        world.dispose();
        world = null;
    }
    
    // 清理窗口管理器
    if (windowManager) {
        windowManager.dispose();
        windowManager = null;
    }
    
    if (dragHandler) {
        dragHandler.dispose();
        dragHandler = null;
    }
    
    if (resizeHandler) {
        resizeHandler = null;
    }
    
    if (contextMenu) {
        contextMenu.dispose();
        contextMenu = null;
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
        
        // 创建窗口管理器
        windowManager = new WindowManager(container);
        
        // 先创建空的 Viewport（不包含 canvas）
        const viewport = new Viewport();
        const viewportWindow = windowManager.createWindow('Viewport', viewport);
        viewportWindow.setPosition(100, 100);
        viewportWindow.setSize(800, 600);
        
        // 获取 Viewport 元素并设置初始尺寸
        const viewportElement = viewport.getElement();
        viewportElement.style.width = '800px';
        viewportElement.style.height = '600px';
        
        // 使用 Viewport 元素初始化 World
        world = new World(viewportElement);
        (window as any).world = world;
        
        // 获取 canvas 并添加到 Viewport
        const canvas = world.getRenderer().domElement;
        viewport.setCanvas(canvas);
        
        // 监听 Viewport 窗口大小变化，更新 renderer
        const updateViewportSize = () => {
            const bounds = viewportWindow.getBounds();
            // 确保 Viewport 元素有正确的尺寸，这样 container.clientWidth/Height 才能正确获取
            viewportElement.style.width = `${bounds.width}px`;
            viewportElement.style.height = `${bounds.height}px`;
            
            // 更新 renderer 尺寸
            world!.getRenderer().setSize(bounds.width, bounds.height);
            world!.getRenderer().setPixelRatio(window.devicePixelRatio);
            
            // 更新相机和 pass manager
            const camera = world!.getCamera();
            const aspect = bounds.width / bounds.height;
            camera.aspect = aspect;
            camera.updateProjectionMatrix();
            
            // 更新 pass manager 尺寸
            const passManager = (world as any).passManager;
            if (passManager) {
                passManager.setSize(bounds.width, bounds.height);
            }
        };
        updateViewportSize();
        
        // 创建 Profiler 窗口
        const profilerPanel = new ProfilerPanel(world.getPerformanceMonitor());
        const profilerWindow = windowManager.createWindow('Profiler', profilerPanel);
        profilerWindow.setPosition(920, 100);
        profilerWindow.setSize(400, 400);
        
        // Initialize UI
        toolbar = new Toolbar(world.getCameraController());
        toolbarContainer.appendChild(toolbar.getElement());
        
        // 初始化交互处理器
        dragHandler = new WindowDragHandler(windowManager);
        resizeHandler = new WindowResizeHandler(windowManager);
        contextMenu = new WindowContextMenu();
        
        // 为所有窗口附加交互处理器
        windowManager.getWindows().forEach(window => {
            dragHandler!.attachToWindow(window);
            resizeHandler!.attachToWindow(window);
            contextMenu!.attachToWindow(window, () => {
                windowManager!.removeWindow(window);
                window.dispose();
            });
        });
        
        // 创建渲染循环（由 main.ts 接管）
        let lastFrameTime = performance.now();
        const renderLoop = async (): Promise<void> => {
            if (!world || !viewportWindow || !windowManager) {
                return;
            }
            
            // 计算 deltaTime（用于 World 内部的更新逻辑）
            const currentTime = performance.now();
            const deltaTime = (currentTime - lastFrameTime) / 1000;
            lastFrameTime = currentTime;
            
            // 更新 World（性能监控、处理器等）
            world.update(deltaTime);
            
            const bounds = viewportWindow.getBounds();
            
            // 计算 gizmo size: 10% * min(viewportWindow.width, viewportWindow.height)
            const gizmoSize = Math.floor(0.2 * Math.min(bounds.width, bounds.height));
            
            // 调用 World.render，传入 viewport 尺寸和 gizmo size
            await world.render(bounds.width, bounds.height, gizmoSize);
            
            requestAnimationFrame(renderLoop);
        };
        
        // 启动渲染循环
        renderLoop();
        
        // 使用 ResizeObserver 监听窗口大小变化
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