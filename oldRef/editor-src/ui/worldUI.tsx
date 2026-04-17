import { createRoot, Root } from 'react-dom/client';
import React from 'react';
import { World } from '../engine';
import { DockviewHost } from './components/DockviewHost';

export interface WorldUI {
    dispose: () => void;
}

export function createWorldUI(paleWorkSpaceContainer: HTMLElement, canvas: HTMLCanvasElement): WorldUI {
    const world = new World(canvas);
    const root: Root = createRoot(paleWorkSpaceContainer);
    root.render(<DockviewHost world={world} />);
    world.startRendering();
    return {
        dispose: () => {
            world.dispose();
            root.unmount();
        },
    };
}