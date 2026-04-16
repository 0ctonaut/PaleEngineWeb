import { createRoot, Root } from 'react-dom/client';
import React from 'react';
import { World } from '../engine';
import { DockviewHost } from './components/DockviewHost';

export interface WorldUI {
    dispose: () => void;
}

export function createWorldUI(paleWorkSpaceContainer: HTMLElement, world: World): WorldUI {
    const root: Root = createRoot(paleWorkSpaceContainer);
    root.render(<DockviewHost world={world} />);
    return {
        dispose: () => root.unmount(),
    };
}