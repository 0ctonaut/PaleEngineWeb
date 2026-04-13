import { World, EditorMode } from '../engine';
import {
    Toolbar,
    BottomBar,
    WindowManager,
    Viewport,
    ProfilerPanel,
    HierarchyPanel,
    InspectorPanel,
    WindowContextMenu
} from '.';

export interface WorldUI {
    windowManager: WindowManager;
    viewport: Viewport;
    gameViewport: Viewport;
    viewportElement: HTMLElement;
    gameViewportElement: HTMLElement;
    attachWorld: (world: World) => void;
    updateViewportSize: () => void;
    update: () => void;
    dispose: () => void;
}

interface Containers {
    toolbarContainer: HTMLElement;
    workspaceContainer: HTMLElement;
    bottombarContainer: HTMLElement;
}

export function createWorldUI(containers: Containers): WorldUI {
    const { workspaceContainer: sceneContainer, toolbarContainer, bottombarContainer } = containers;

    const windowManager = new WindowManager({ host: sceneContainer });
    const viewport = new Viewport('Scene');
    const viewportNode = windowManager.createInitialWindow(viewport);
    const viewportElement = viewport.getElement();
    
    // 创建 Game viewport 并添加到同一个 tab container
    const gameViewport = new Viewport('Game');
    const gameViewportNode = windowManager.stackWithSimple(viewportNode.id, gameViewport);
    const gameViewportElement = gameViewport.getElement();

    let world: World | null = null;
    let toolbar: Toolbar | null = null;
    let bottomBar: BottomBar | null = null;
    let panelsInitialized = false;
    const contextMenu = new WindowContextMenu(sceneContainer, windowManager);
    const handleContextMenu = (event: MouseEvent) => {
        event.preventDefault();
    };
    const handleSelectStart = (event: Event) => {
        event.preventDefault();
    };

    // 禁用浏览器的选中文字和右键菜单
    sceneContainer.addEventListener('contextmenu', handleContextMenu);
    sceneContainer.addEventListener('selectstart', handleSelectStart);

    const attachWorld = (worldInstance: World) => {
        world = worldInstance;

        const canvas = world.getRenderer().domElement;
        viewport.setCanvas(canvas);
        
        // Game viewport 使用单独的 renderer
        const gameCanvas = world.getGameRenderer().domElement;
        gameViewport.setCanvas(gameCanvas);

        if (!panelsInitialized) {
            const hierarchyPanel = new HierarchyPanel(world);
            const inspectorPanel = new InspectorPanel(world);
            const profilerPanel = new ProfilerPanel(world.getPerformanceMonitor());

            // Step 1: Add hierarchyPanel to the left of viewport (horizontal, 'before')
            // This creates a horizontal SplitContainer as root with [hierarchyPanel, viewport]
            windowManager.divideWindowWith(
                viewportNode.id,
                'horizontal',
                hierarchyPanel,
                'before'
            );

            // Step 2: Add inspectorPanel to the right of viewport (horizontal, 'after')
            // Since viewport's parent is horizontal SplitContainer with same direction,
            // this triggers node promotion, adding inspectorPanel to the same horizontal SplitContainer
            // Result: [hierarchyPanel, viewport, inspectorPanel]
            windowManager.divideWindowWith(
                viewportNode.id,
                'horizontal',
                inspectorPanel,
                'after'
            );

            // Step 3: Add profilerPanel below viewport (vertical, 'after')
            // Since viewport's parent is horizontal SplitContainer with different direction,
            // this creates a vertical SplitContainer replacing viewport's TabContainer
            // Result: horizontal root [hierarchyPanel, vertical SplitContainer, inspectorPanel]
            //         vertical SplitContainer [viewport, profilerPanel]
            windowManager.divideWindowWith(
                viewportNode.id,
                'vertical',
                profilerPanel,
                'after'
            );

            // Step 4: Set ratios for horizontal root SplitContainer: 1/4, 2/4, 1/4
            // ratios[0] = 0.25 (first divider at 25%, hierarchyPanel = 25%)
            // ratios[1] = 0.75 (second divider at 75%, hierarchyPanel + middle = 75%, so middle = 50%, inspectorPanel = 25%)
            const rootId = windowManager.getRootId();
            if (rootId) {
                windowManager.updateSplitRatio(rootId, 0, 0.2);
                windowManager.updateSplitRatio(rootId, 1, 0.8);
            }

            // Step 5: Set ratio for vertical SplitContainer (middle): 1/2, 1/2
            // Find the vertical SplitContainer by getting viewport's parent (TabContainer), then its parent (vertical SplitContainer)
            const viewportNodeAfterDivide = windowManager.getNode(viewportNode.id);
            if (viewportNodeAfterDivide && viewportNodeAfterDivide.parentId) {
                const viewportTabContainer = windowManager.getNode(viewportNodeAfterDivide.parentId);
                if (viewportTabContainer && viewportTabContainer.parentId) {
                    const verticalSplitContainer = windowManager.getNode(viewportTabContainer.parentId);
                    if (verticalSplitContainer && verticalSplitContainer.type === 'split' && verticalSplitContainer.direction === 'vertical') {
                        // Set ratio to 0.5 (viewport and profilerPanel each 50%)
                        windowManager.updateSplitRatio(verticalSplitContainer.id, 0, 0.8);
                    }
                }
            }

            windowManager.activate(viewportNode.id);
            panelsInitialized = true;
        }

        toolbar = new Toolbar(world.getCameraController(), world);
        toolbarContainer.appendChild(toolbar.getElement());
        
        bottomBar = new BottomBar(world);
        bottombarContainer.appendChild(bottomBar.getElement());
        
        // 监听模式切换，自动聚焦到对应的 viewport
        world.getModeManager().onModeChange((event) => {
            if (event.currentMode === EditorMode.Game) {
                windowManager.activate(gameViewportNode.id);
            } else {
                windowManager.activate(viewportNode.id);
            }
        });
        
        updateViewportSize();
    };

    const updateViewportSize = () => {
        const sceneBounds = viewportElement.getBoundingClientRect();
        const gameBounds = gameViewportElement.getBoundingClientRect();

        if (!world) {
            return;
        }

        // 更新 Scene renderer
        const renderer = world.getRenderer();
        renderer.setSize(sceneBounds.width, sceneBounds.height);
        renderer.setPixelRatio(window.devicePixelRatio);

        const camera = world.getCamera();
        const sceneAspect = sceneBounds.width / sceneBounds.height;
        camera.aspect = sceneAspect;
        camera.updateProjectionMatrix();

        // 更新 Game renderer
        const gameRenderer = world.getGameRenderer();
        gameRenderer.setSize(gameBounds.width, gameBounds.height);
        gameRenderer.setPixelRatio(window.devicePixelRatio);

        const mainCameraComponent = world.getMainCameraComponent();
        if (mainCameraComponent) {
            const gameAspect = gameBounds.width / gameBounds.height;
            mainCameraComponent.aspect = gameAspect;
        }

        const passManager = (world as any).passManager;
        if (passManager) {
            passManager.setSize(sceneBounds.width, sceneBounds.height);
        }
    };

    const update = () => {
        if (bottomBar) {
            bottomBar.update();
        }
    };

    const dispose = () => {
        contextMenu.dispose();

        if (toolbar) {
            const toolbarElement = toolbar.getElement();
            if (toolbarElement && toolbarElement.parentNode) {
                toolbarElement.parentNode.removeChild(toolbarElement);
            }
            toolbar = null;
        }

        if (bottomBar) {
            bottomBar.dispose();
            bottomBar = null;
        }

        windowManager.dispose();
        sceneContainer.removeEventListener('contextmenu', handleContextMenu);
        sceneContainer.removeEventListener('selectstart', handleSelectStart);
    };

    return {
        windowManager,
        viewport,
        gameViewport,
        viewportElement,
        gameViewportElement,
        attachWorld,
        updateViewportSize,
        update,
        dispose,
    };
}

