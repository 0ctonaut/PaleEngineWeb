import { World } from '../engine';
import {
    Toolbar,
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
    sceneContainer: HTMLElement;
    toolbarContainer: HTMLElement;
}

export function createWorldUI(containers: Containers): WorldUI {
    const { sceneContainer, toolbarContainer } = containers;

    const windowManager = new WindowManager({ host: sceneContainer });
    const viewport = new Viewport();
    const viewportNode = windowManager.createInitialWindow(viewport);
    const viewportElement = viewport.getElement();

    let world: World | null = null;
    let toolbar: Toolbar | null = null;
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

            const hierarchyNode = windowManager.divideWindowWith(
                viewportNode.id,
                'horizontal',
                hierarchyPanel,
                'before'
            );
            windowManager.stackWithSimple(hierarchyNode.id, inspectorPanel);
            windowManager.stackWithSimple(hierarchyNode.id, profilerPanel);
            windowManager.activate(hierarchyNode.id);
            panelsInitialized = true;
        }

        toolbar = new Toolbar(world.getCameraController());
        toolbarContainer.appendChild(toolbar.getElement());
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

