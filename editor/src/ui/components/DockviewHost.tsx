import React, { createContext, useContext, useEffect, useRef } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { DockviewReact, IDockviewReactProps, DockviewReadyEvent } from 'dockview';
import { World } from '../../engine';

export interface DockviewHostProps {
    world: World | null;
}

const WorldContext = createContext<World | null>(null);

const SceneViewportPanel: React.FC = () => {
    const world = useContext(WorldContext);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current || !world) return;

        const container = containerRef.current;
        const canvas = world.getRenderer().domElement;

        if (canvas.parentNode !== container) {
            if (canvas.parentNode) {
                canvas.parentNode.removeChild(canvas);
            }
            container.appendChild(canvas);
        }

        canvas.style.width = '100%';
        canvas.style.height = '100%';

        const updateSize = () => {
            if (!world) return;

            const bounds = container.getBoundingClientRect();
            const renderer = world.getRenderer();
            renderer.setSize(bounds.width, bounds.height);
            renderer.setPixelRatio(window.devicePixelRatio);

            const camera = world.getCamera();
            camera.aspect = bounds.width / bounds.height;
            camera.updateProjectionMatrix();

            const passManager = (world as any).passManager;
            if (passManager) {
                passManager.setSize(bounds.width, bounds.height);
            }
        };

        const resizeObserver = new ResizeObserver(updateSize);
        resizeObserver.observe(container);

        updateSize();

        return () => {
            resizeObserver.disconnect();
        };
    }, [world]);

    return (
        <div
            ref={containerRef}
            style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
                backgroundColor: '#1a1a1a'
            }}
        />
    );
};

export const DockviewHost: React.FC<DockviewHostProps> = ({ world }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const rootRef = useRef<Root | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        rootRef.current = createRoot(containerRef.current);

        const components: Record<string, React.FC> = {
            'viewport': () => (
                <WorldContext.Provider value={world}>
                    <SceneViewportPanel />
                </WorldContext.Provider>
            ),
        };

        const onReady = (event: DockviewReadyEvent) => {
            event.api.addPanel({
                id: 'scene-viewport',
                component: 'viewport',
                title: 'Scene',
            });
        };

        const reactProps: IDockviewReactProps = {
            components,
            onReady,
        };

        rootRef.current.render(<DockviewReact {...reactProps} />);

        return () => {
            if (rootRef.current) {
                rootRef.current.unmount();
            }
        };
    }, []);

    useEffect(() => {
        // Trigger re-render when world changes to update the Context
    }, [world]);

    return (
        <div
            ref={containerRef}
            style={{
                width: '100%',
                height: '100%',
            }}
        />
    );
};