import { World } from '../engine';
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
    viewportElement: HTMLElement;
    attachWorld: (world: World) => void;
    updateViewportSize: () => void;
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
    const viewport = new Viewport();
    const viewportNode = windowManager.createInitialWindow(viewport);
    const viewportElement = viewport.getElement();

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
        
        updateViewportSize();
    };

    const updateViewportSize = () => {
        const bounds = viewportElement.getBoundingClientRect();

        if (!world) {
            return;
        }

        const renderer = world.getRenderer();
        renderer.setSize(bounds.width, bounds.height);
        renderer.setPixelRatio(window.devicePixelRatio);

        const camera = world.getCamera();
        const aspect = bounds.width / bounds.height;
        camera.aspect = aspect;
        camera.updateProjectionMatrix();

        const passManager = (world as any).passManager;
        if (passManager) {
            passManager.setSize(bounds.width, bounds.height);
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
        viewportElement,
        attachWorld,
        updateViewportSize,
        dispose,
    };
}

