import { PaleObject } from './pale-object';

export type HierarchyChangeType = 'refresh' | 'add' | 'remove';

export interface HierarchyChangeEvent {
	objects: PaleObject[];
	parent?: PaleObject | null;
	type: HierarchyChangeType;
}

export interface SceneEventMap {
	hierarchychange: HierarchyChangeEvent;
}