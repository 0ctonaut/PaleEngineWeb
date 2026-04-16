import React, { useRef, useEffect } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { DockviewReact, IDockviewReactProps, DockviewReadyEvent } from 'dockview';
import { World } from '../../engine';
import { SceneViewportPanel, WorldProvider } from './ViewportPanel';

export interface DockviewHostProps {
    world: World | null;
}

export const DockviewHost: React.FC<DockviewHostProps> = ({ world }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const rootRef = useRef<Root | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        rootRef.current = createRoot(containerRef.current);

        const components: Record<string, React.FC> = {
            'viewport': () => (
                <WorldProvider value={world}>
                    <SceneViewportPanel />
                </WorldProvider>
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