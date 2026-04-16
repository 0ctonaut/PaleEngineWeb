import { createRoot, Root } from 'react-dom/client';
import React from 'react';
import { World } from '../engine';
import { DockviewHost } from './components/DockviewHost';

export interface WorldUI {
    dispose: () => void;
}

interface Containers {
    workspaceContainer: HTMLElement;
}

export function createWorldUI(containers: Containers): WorldUI {
    const { workspaceContainer } = containers;

    const root: Root = createRoot(workspaceContainer);

    let world: World | null = null;

    const attachWorld = (worldInstance: World) => {
        world = worldInstance;
        root.render(<DockviewHost world={world} />);
    };

    const dispose = () => {
        root.unmount();
    };

    (window as any).attachWorld = attachWorld;

    return {
        dispose,
    };
}