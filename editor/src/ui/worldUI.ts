import { World } from '../engine';
import {
    Toolbar,
    WindowContextMenu,
    WindowDragHandler,
    WindowManager,
    WindowResizeHandler,
    Viewport,
    ProfilerPanel,
    HierarchyPanel,
    InspectorPanel,
} from '.';

export interface WorldUI {
    windowManager: WindowManager;
    viewportWindow: ReturnType<WindowManager['createWindow']>;
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

    const windowManager = new WindowManager(sceneContainer);

    const viewport = new Viewport();
    const viewportWindow = windowManager.createWindow(viewport);
    viewportWindow.setPosition(100, 100);
    viewportWindow.setSize(800, 600);

    const viewportContainerElement = viewportWindow.getElement();
    const viewportContentElement = viewportContainerElement.querySelector('.window-viewport') as HTMLElement | null;
    const viewportElement = viewportContentElement ?? viewportContainerElement;
    viewportElement.style.width = '800px';
    viewportElement.style.height = '600px';

    let world: World | null = null;
    let toolbar: Toolbar | null = null;
    let dragHandler: WindowDragHandler | null = null;
    let resizeHandler: WindowResizeHandler | null = null;
    let contextMenu: WindowContextMenu | null = null;

    const createPanels = () => {
        if (!world) {
            return;
        }

        const hierarchyPanel = new HierarchyPanel(world);
        const hierarchyWindow = windowManager.createWindow(hierarchyPanel);
        hierarchyWindow.setPosition(20, 100);
        hierarchyWindow.setSize(280, 500);
        hierarchyWindow.getElement().classList.add('window--hierarchy');

        const inspectorPanel = new InspectorPanel(world);
        const inspectorWindow = windowManager.createWindow(inspectorPanel);
        inspectorWindow.setPosition(320, 100);
        inspectorWindow.setSize(300, 400);
        inspectorWindow.getElement().classList.add('window--inspector');

        const profilerPanel = new ProfilerPanel(world.getPerformanceMonitor());
        const profilerWindow = windowManager.createWindow(profilerPanel);
        profilerWindow.setPosition(920, 100);
        profilerWindow.setSize(400, 400);
    };

    const attachWindowHandlers = () => {
        if (!dragHandler || !resizeHandler || !contextMenu) {
            return;
        }

        windowManager.getWindows().forEach((windowContainer: ReturnType<WindowManager['createWindow']>) => {
            dragHandler!.attachToWindow(windowContainer);
            resizeHandler!.attachToWindow(windowContainer);
            contextMenu!.attachToWindow(windowContainer, () => {
                windowManager.removeWindow(windowContainer);
            });
        });
    };

    const attachWorld = (worldInstance: World) => {
        world = worldInstance;

        const canvas = world.getRenderer().domElement;
        viewport.setCanvas(canvas);

        createPanels();

        toolbar = new Toolbar(world.getCameraController());
        toolbarContainer.appendChild(toolbar.getElement());

        dragHandler = new WindowDragHandler(windowManager);
        resizeHandler = new WindowResizeHandler(windowManager);
        contextMenu = new WindowContextMenu();

        attachWindowHandlers();
    };

    const updateViewportSize = () => {
        const bounds = viewportWindow.getBounds();
        viewportElement.style.width = `${bounds.width}px`;
        viewportElement.style.height = `${bounds.height}px`;

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
        if (contextMenu) {
            contextMenu.dispose();
            contextMenu = null;
        }

        if (dragHandler) {
            dragHandler.dispose();
            dragHandler = null;
        }

        resizeHandler = null;

        if (toolbar) {
            const toolbarElement = toolbar.getElement();
            if (toolbarElement && toolbarElement.parentNode) {
                toolbarElement.parentNode.removeChild(toolbarElement);
            }
            toolbar = null;
        }

        windowManager.dispose();
    };

    return {
        windowManager,
        viewportWindow,
        viewport,
        viewportElement,
        attachWorld,
        updateViewportSize,
        dispose,
    };
}

