import { Node, Vector3, Quaternion } from 'babylonjs';
import type { MonoBehaviour } from '../components/mono-behavior';
import type { SelectionCategoryType } from './layers';

export class PaleObject {
    private static _idCounter: number = 0;
    private readonly _id: number;
    private readonly _babylonNode: Node;
    private readonly _components: MonoBehaviour[] = [];
    private _name: string;
    private _tag: SelectionCategoryType | null = null;
    private _parent: PaleObject | null = null;

    constructor(babylonNode: Node, name?: string) {
        this._id = ++PaleObject._idCounter;
        this._babylonNode = babylonNode;
        this._name = name || babylonNode.name || 'GameObject';
        this._babylonNode.name = this._name;

        (babylonNode as any).__paleObject = this;

        if (babylonNode.metadata?.selectionCategory) {
            this._tag = babylonNode.metadata.selectionCategory as SelectionCategoryType;
        }
    }

    public getBabylonNode(): Node {
        return this._babylonNode;
    }

    public get id(): number {
        return this._id;
    }

    public get name(): string {
        return this._name;
    }

    public set name(value: string) {
        this._name = value;
        this._babylonNode.name = value;
    }

    public get position(): Vector3 {
        if ((this._babylonNode as any).position) {
            return (this._babylonNode as any).position;
        }
        return Vector3.Zero();
    }

    public set position(value: Vector3) {
        if ((this._babylonNode as any).position) {
            (this._babylonNode as any).position.copyFrom(value);
        }
    }

    public get rotation(): Vector3 {
        if ((this._babylonNode as any).rotation) {
            return (this._babylonNode as any).rotation;
        }
        return Vector3.Zero();
    }

    public set rotation(value: Vector3) {
        if ((this._babylonNode as any).rotation) {
            (this._babylonNode as any).rotation.copyFrom(value);
        }
    }

    public get scale(): Vector3 {
        if ((this._babylonNode as any).scaling) {
            return (this._babylonNode as any).scaling;
        }
        return Vector3.One();
    }

    public set scale(value: Vector3) {
        if ((this._babylonNode as any).scaling) {
            (this._babylonNode as any).scaling.copyFrom(value);
        }
    }

    public get quaternion(): Quaternion {
        if ((this._babylonNode as any).rotationQuaternion) {
            return (this._babylonNode as any).rotationQuaternion;
        }
        if ((this._babylonNode as any).rotation) {
            (this._babylonNode as any).rotationQuaternion = (this._babylonNode as any).rotation.toQuaternion();
            return (this._babylonNode as any).rotationQuaternion;
        }
        return Quaternion.Identity();
    }

    public set quaternion(value: Quaternion) {
        if ((this._babylonNode as any).rotationQuaternion) {
            (this._babylonNode as any).rotationQuaternion = value.clone();
        }
    }

    public get visible(): boolean {
        return this._babylonNode.isEnabled();
    }

    public set visible(value: boolean) {
        this._babylonNode.setEnabled(value);
    }

    public get metadata(): any {
        return this._babylonNode.metadata;
    }

    public get tag(): SelectionCategoryType | null {
        return this._tag;
    }

    public set tag(value: SelectionCategoryType | null) {
        this._tag = value;
        if (value) {
            this._babylonNode.metadata = this._babylonNode.metadata || {};
            this._babylonNode.metadata.selectionCategory = value;
        } else if (this._babylonNode.metadata) {
            delete this._babylonNode.metadata.selectionCategory;
        }
    }

    public get parent(): PaleObject | null {
        return this._parent;
    }

    public get children(): PaleObject[] {
        if ((this._babylonNode as any).getChildMeshes) {
            return (this._babylonNode as any).getChildMeshes()
                .map((child: any) => child.__paleObject)
                .filter((child: any): child is PaleObject => child !== undefined && child !== null);
        }
        return [];
    }

    public addChild(child: PaleObject): void {
        if (child._parent === this) return;

        (this._babylonNode as any).setParent(child._babylonNode);
        child._parent = this;
    }

    public removeChild(child: PaleObject): void {
        if (child._parent !== this) return;

        (child._babylonNode as any).setParent(null);
        child._parent = null;
    }

    public addComponent<T extends MonoBehaviour>(component: T): T {
        if (this._components.includes(component)) {
            console.warn(`Component already added to ${this.name}`);
            return component;
        }

        (component as any).gameObject = this;
        this._components.push(component);
        return component;
    }

    public getComponent<T extends MonoBehaviour>(type: new (...args: any[]) => T): T | null {
        return this._components.find(c => c instanceof type) as T || null;
    }

    public getComponents<T extends MonoBehaviour>(type: new (...args: any[]) => T): T[] {
        return this._components.filter(c => c instanceof type) as T[];
    }

    public removeComponent(component: MonoBehaviour): void {
        const index = this._components.indexOf(component);
        if (index > -1) {
            this._components.splice(index, 1);
            if (component.enabled) {
                component.OnDisable();
            }
            component.OnDestroy();
            (component as any).gameObject = null;
        }
    }

    public getAllComponents(): MonoBehaviour[] {
        return [...this._components];
    }

    public traverse(callback: (object: PaleObject) => void): void {
        callback(this);
        for (const child of this.children) {
            child.traverse(callback);
        }
    }

    public clone(name?: string): PaleObject {
        const clonedNode = (this._babylonNode as any).clone(name || (this._babylonNode.name + '_clone'));
        const cloned = new PaleObject(clonedNode, name || this._name);

        for (const _component of this._components) {
            // TODO: 复制组件
        }

        return cloned;
    }

    public dispose(): void {
        for (const component of this._components) {
            if (component.enabled) {
                component.OnDisable();
            }
            component.OnDestroy();
        }
        this._components.length = 0;

        for (const child of this.children) {
            child.dispose();
        }

        if (this._parent) {
            this._parent.removeChild(this);
        }

        this._babylonNode.dispose();
    }
}