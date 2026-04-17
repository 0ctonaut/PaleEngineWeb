import { Object3D, Vector3, Euler, Quaternion } from 'three/webgpu';
import type { MonoBehaviour } from '../components/mono-behavior';
import type { SelectionCategoryType } from './layers';

export class PaleObject {
    private static _idCounter: number = 0;
    private readonly _id: number;
    private readonly _threeObject: Object3D;
    private readonly _components: MonoBehaviour[] = [];
    private _name: string;
    private _tag: SelectionCategoryType | null = null;
    private _parent: PaleObject | null = null;

    constructor(threeObject: Object3D, name?: string) {
        this._id = ++PaleObject._idCounter;
        this._threeObject = threeObject;
        this._name = name || threeObject.name || 'GameObject';
        this._threeObject.name = this._name;

        (threeObject as any).__paleObject = this;

        if (threeObject.userData?.selectionCategory) {
            this._tag = threeObject.userData.selectionCategory as SelectionCategoryType;
        }
    }

    public getThreeObject(): Object3D {
        return this._threeObject;
    }

    public get id(): number {
        return this._id;
    }

    public get name(): string {
        return this._name;
    }

    public set name(value: string) {
        this._name = value;
        this._threeObject.name = value;
    }

    public get position(): Vector3 {
        return this._threeObject.position;
    }

    public set position(value: Vector3) {
        this._threeObject.position.copy(value);
    }

    public get rotation(): Euler {
        return this._threeObject.rotation;
    }

    public set rotation(value: Euler) {
        this._threeObject.rotation.copy(value);
    }

    public get scale(): Vector3 {
        return this._threeObject.scale;
    }

    public set scale(value: Vector3) {
        this._threeObject.scale.copy(value);
    }

    public get quaternion(): Quaternion {
        return this._threeObject.quaternion;
    }

    public set quaternion(value: Quaternion) {
        this._threeObject.quaternion.copy(value);
    }

    public get visible(): boolean {
        return this._threeObject.visible;
    }

    public set visible(value: boolean) {
        this._threeObject.visible = value;
    }

    public get userData(): any {
        return this._threeObject.userData;
    }

    public get tag(): SelectionCategoryType | null {
        return this._tag;
    }

    public set tag(value: SelectionCategoryType | null) {
        this._tag = value;
        if (value) {
            this._threeObject.userData.selectionCategory = value;
        } else {
            delete this._threeObject.userData.selectionCategory;
        }
    }

    public get parent(): PaleObject | null {
        return this._parent;
    }

    public get children(): PaleObject[] {
        return this._threeObject.children
            .map(child => (child as any).__paleObject)
            .filter((child): child is PaleObject => child !== undefined && child !== null);
    }

    public addChild(child: PaleObject): void {
        if (child._parent === this) return;

        this._threeObject.add(child._threeObject);
        child._parent = this;
    }

    public removeChild(child: PaleObject): void {
        if (child._parent !== this) return;

        this._threeObject.remove(child._threeObject);
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

    public clone(): PaleObject {
        const clonedThree = this._threeObject.clone();
        const cloned = new PaleObject(clonedThree, this._name);

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

        this._threeObject.parent?.remove(this._threeObject);
    }
}