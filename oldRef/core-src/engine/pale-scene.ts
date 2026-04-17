import { Scene, Color4, Engine } from 'babylonjs';
import { PaleObject } from './pale-object';
import { ComponentManager } from '../components/component-manager';
import { EventEmitter } from './event-emitter';
import { SceneEventMap } from './scene-events';

export interface SceneNode {
    object: PaleObject;
    children: SceneNode[];
}

export class PaleScene {
    private readonly _babylonScene: Scene;
    private readonly _objects: Set<PaleObject> = new Set();
    private readonly _componentManager: ComponentManager;
    private readonly _rootNodes: SceneNode[] = [];
    private readonly _eventEmitter: EventEmitter<SceneEventMap>;

    constructor(engine: Engine, backgroundColor: string | number = 'dimgray') {
        this._babylonScene = new Scene(engine);
        if (backgroundColor !== null) {
            const color = this.parseColor(backgroundColor);
            this._babylonScene.clearColor = color;
        }
        this._componentManager = new ComponentManager();
        this._eventEmitter = new EventEmitter<SceneEventMap>();
    }

    private parseColor(color: string | number): Color4 {
        if (typeof color === 'number') {
            const r = ((color >> 16) & 255) / 255;
            const g = ((color >> 8) & 255) / 255;
            const b = (color & 255) / 255;
            return new Color4(r, g, b, 1);
        }

        const cssColor = color.toLowerCase();
        const tempDiv = document.createElement('div');
        tempDiv.style.color = cssColor;
        document.body.appendChild(tempDiv);
        const computedColor = getComputedStyle(tempDiv).color;
        document.body.removeChild(tempDiv);

        const match = computedColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (match) {
            return new Color4(
                parseInt(match[1]) / 255,
                parseInt(match[2]) / 255,
                parseInt(match[3]) / 255,
                1
            );
        }
        return new Color4(0.5, 0.5, 0.5, 1);
    }

    public getBabylonScene(): Scene {
        return this._babylonScene;
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
        object.getBabylonNode().parent = null;

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

        object.getBabylonNode().dispose();

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
    }

    public update(deltaTime: number): void {
        this._componentManager.update(deltaTime);
    }
}