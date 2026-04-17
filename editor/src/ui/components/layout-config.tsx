import { HierarchyPanel } from './HierarchyPanel';
import { SceneViewportPanel } from './ViewportPanel';
import React from 'react';
import defaultLayoutJson from '../../../resources/default-layout.json';

export type PanelComponentType = 'hierarchy' | 'viewport';

export interface PanelConfig {
    id: string;
    component: PanelComponentType;
    title: string;
    position?: {
        referencePanel: string;
        direction: 'left' | 'right' | 'above' | 'below';
    };
    size?: number | string;
}

export interface LayoutConfig {
    panels: PanelConfig[];
}

export const PANEL_COMPONENTS: Record<PanelComponentType, React.FC> = {
    'hierarchy': () => <HierarchyPanel />,
    'viewport': () => <SceneViewportPanel />,
};

export const DEFAULT_LAYOUT: LayoutConfig = defaultLayoutJson as LayoutConfig;
export const LAYOUT_STORAGE_KEY = 'pale-editor-layout';

export function loadLayout(): LayoutConfig {
    try {
        const saved = localStorage.getItem(LAYOUT_STORAGE_KEY);
        if (saved) {
            return JSON.parse(saved) as LayoutConfig;
        }
    } catch (e) {
        console.warn('Failed to load layout:', e);
    }
    return DEFAULT_LAYOUT;
}

export function saveLayout(layout: LayoutConfig): void {
    try {
        localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    } catch (e) {
        console.warn('Failed to save layout:', e);
    }
}

export function resolvePanelSize(size: number | string | undefined, containerSize: number): number | undefined {
    if (size === undefined) return undefined;
    if (typeof size === 'number') return size;
    if (typeof size === 'string' && size.endsWith('%')) {
        const percent = parseFloat(size.slice(0, -1));
        if (!isNaN(percent)) {
            return Math.round(containerSize * percent / 100);
        }
    }
    return undefined;
}