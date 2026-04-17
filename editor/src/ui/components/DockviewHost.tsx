import React, { useRef, useEffect } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { DockviewReact, IDockviewReactProps, DockviewReadyEvent } from 'dockview';
import {
    PANEL_COMPONENTS,
    loadLayout,
    saveLayout,
    resolvePanelSize,
} from './layout-config';
import { WorldProvider } from './ViewportPanel';

export interface DockviewHostProps {
    world: any;
}

export const DockviewHost: React.FC<DockviewHostProps> = ({ world }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const rootRef = useRef<Root | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        rootRef.current = createRoot(containerRef.current);

        const layout = loadLayout();
        let panelsAdded = false;

        const addPanels = (event: DockviewReadyEvent) => {
            if (panelsAdded) return;
            panelsAdded = true;

            for (const panelConfig of layout.panels) {
                const panelParams: any = {
                    id: panelConfig.id,
                    component: panelConfig.component as string,
                    title: panelConfig.title,
                };

                if (panelConfig.position) {
                    panelParams.position = {
                        referencePanel: panelConfig.position.referencePanel,
                        direction: panelConfig.position.direction,
                    };
                }

                event.api.addPanel(panelParams);
            }

            setTimeout(() => {
                const containerWidth = containerRef.current?.clientWidth ?? window.innerWidth;

                for (const panelConfig of layout.panels) {
                    const group = event.api.getPanel(panelConfig.id)?.group;
                    if (group && panelConfig.size !== undefined) {
                        const targetWidth = resolvePanelSize(panelConfig.size, containerWidth);
                        if (targetWidth) {
                            (group.api as any).setSize({ width: targetWidth, height: group.height });
                        }
                    }
                }
            }, 10);

            event.api.onDidLayoutChange(() => {
                const currentPanels = layout.panels.map(panelConfig => {
                    const group = event.api.getPanel(panelConfig.id)?.group;
                    if (group) {
                        const containerWidth = containerRef.current?.clientWidth ?? window.innerWidth;
                        const percent = Math.round((group.width / containerWidth) * 100);
                        return { ...panelConfig, size: `${percent}%` };
                    }
                    return panelConfig;
                });
                saveLayout({ panels: currentPanels });
            });
        };

        const reactProps: IDockviewReactProps = {
            components: PANEL_COMPONENTS,
            onReady: (event) => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        addPanels(event);
                    });
                });
            },
        };

        rootRef.current.render(
            <WorldProvider value={world}>
                <DockviewReact {...reactProps} />
            </WorldProvider>
        );

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