import { Scene, Color } from 'three/webgpu';
import { PaleObject } from './pale-object';
import { ComponentManager } from '../components/component-manager';
import { EventEmitter } from './event-emitter';
import { SceneEventMap } from './scene-events';

export interface SceneNode {
	object: PaleObject;
	children: SceneNode[];
}

export class PaleScene {
	private readonly _threeScene: Scene;
	private readonly _objects: Set<PaleObject> = new Set();
	private readonly _componentManager: ComponentManager;
	private readonly _rootNodes: SceneNode[] = [];
	private readonly _eventEmitter: EventEmitter<SceneEventMap>;

	constructor(backgroundColor: string | number = 'dimgray') {
		this._threeScene = new Scene();
		if (backgroundColor !== null) {
			this._threeScene.background = new Color(backgroundColor);
		}
		this._componentManager = new ComponentManager();
		this._eventEmitter = new EventEmitter<SceneEventMap>();
	}

	public getThreeScene(): Scene {
		return this._threeScene;
	}

	public getComponentManager(): ComponentManager {
		return this._componentManager;
	}

	public getRootNodes(): SceneNode[] {
		this.buildRootNodes();
		return this._rootNodes;
	}

	private buildRootNodes(): void {
		this._rootNodes.length = 0;

		for (const object of this._objects) {
			if (object.parent === null) {
				this._rootNodes.push(this.buildSceneNode(object));
			}
		}
	}

	private buildSceneNode(object: PaleObject): SceneNode {
		return {
			object,
			children: object.children.map((child) => this.buildSceneNode(child))
		};
	}

	public add(object: PaleObject): void {
		if (this._objects.has(object)) {
			console.warn(`Object ${object.name} is already in the scene`);
			return;
		}

		const addedObjects: PaleObject[] = [object];

		this._objects.add(object);
		this._threeScene.add(object.getThreeObject());

		const components = object.getAllComponents();
		for (const component of components) {
			this._componentManager.registerComponent(component);
		}

		object.traverse((child) => {
			if (child !== object) {
				this._objects.add(child);
				addedObjects.push(child);
				const childComponents = child.getAllComponents();
				for (const component of childComponents) {
					this._componentManager.registerComponent(component);
				}
			}
		});

		this._eventEmitter.emit('hierarchychange', {
			type: 'add',
			objects: addedObjects,
			parent: object.parent
		});
	}

	public remove(object: PaleObject): void {
		if (!this._objects.has(object)) {
			console.warn(`Object ${object.name} is not in the scene`);
			return;
		}

		const parent = object.parent;
		const removedObjects: PaleObject[] = [];

		object.traverse((child) => {
			removedObjects.push(child);
			const components = child.getAllComponents();
			for (const component of components) {
				this._componentManager.unregisterComponent(component);
			}
			this._objects.delete(child);
		});

		object.getThreeObject().parent?.remove(object.getThreeObject());

		this._eventEmitter.emit('hierarchychange', {
			type: 'remove',
			objects: removedObjects,
			parent
		});
	}

	public on<K extends keyof SceneEventMap>(
		type: K,
		listener: (event: SceneEventMap[K]) => void
	): () => void {
		return this._eventEmitter.on(type, listener);
	}

	public off<K extends keyof SceneEventMap>(
		type: K,
		listener: (event: SceneEventMap[K]) => void
	): void {
		this._eventEmitter.off(type, listener);
	}

	public getObjects(): PaleObject[] {
		return Array.from(this._objects);
	}

	public clear(): void {
		const objects = Array.from(this._objects);
		for (const object of objects) {
			this.remove(object);
		}

		this._rootNodes.length = 0;
		this._threeScene.clear();
	}

	public update(deltaTime: number): void {
		this._componentManager.update(deltaTime);
	}

	public reset(): void {
		this._componentManager.reset();
	}
}