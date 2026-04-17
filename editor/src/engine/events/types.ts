import { Scene } from 'three/webgpu';
import { PaleObject } from '@paleengine/core';

export type HierarchyChangeType = 'refresh' | 'add' | 'remove';

export interface HierarchyChangeEvent {
	scene: Scene;
	type: HierarchyChangeType;
	objects: PaleObject[];
	parent?: PaleObject | null;
}

export interface SelectionChangeEvent {
	selected: Set<PaleObject>;
}

export type WorldEventMap = {
	selectionchange: SelectionChangeEvent;
	hierarchychange: HierarchyChangeEvent;
};