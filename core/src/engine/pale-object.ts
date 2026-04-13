import { Object3D, Vector3, Euler, Quaternion } from 'three/webgpu';
import type { MonoBehaviour } from '../components/mono-behavior';
import type { SelectionCategoryType } from './layers';

export class PaleObject {
    private readonly _threeObject: Object3D;
    private readonly _components: MonoBehaviour[] = [];
    private _name: string;
    private _tag: SelectionCategoryType | null = null;

    constructor(threeObject: Object3D, name?: string) {
        this._threeObject = threeObject;
        this._name = name || threeObject.name || 'GameObject';
        this._threeObject.name = this._name;
        
        // 从 userData 迁移 tag（向后兼容）
        if (threeObject.userData?.selectionCategory) {
            this._tag = threeObject.userData.selectionCategory as SelectionCategoryType;
            // 保留 userData 中的值以便向后兼容，但优先使用 tag 属性
        }
    }

    public getThreeObject(): Object3D {
        return this._threeObject;
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

    /**
     * Tag - 对象的标签（用于选择和过滤）
     * 从原来的 userData.selectionCategory 迁移而来
     */
    public get tag(): SelectionCategoryType | null {
        return this._tag;
    }

    public set tag(value: SelectionCategoryType | null) {
        this._tag = value;
        // 同步到 userData 以便向后兼容
        if (value) {
            this._threeObject.userData.selectionCategory = value;
        } else {
            delete this._threeObject.userData.selectionCategory;
        }
    }

    public get parent(): PaleObject | null {
        const parent = this._threeObject.parent;
        if (!parent) return null;
        // 如果父对象有 PaleObject 包装，返回它
        return (parent as any).__paleObject || null;
    }

    public get children(): PaleObject[] {
        return this._threeObject.children.map(child => {
            return (child as any).__paleObject || new PaleObject(child);
        });
    }

    public addComponent<T extends MonoBehaviour>(component: T): T {
        if (this._components.includes(component)) {
            console.warn(`Component already added to ${this.name}`);
            return component;
        }

        // 设置组件的 gameObject 引用
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
            // 调用 OnDestroy
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

    public add(child: PaleObject): void {
        this._threeObject.add(child._threeObject);
        // 在 Three.js 对象上保存 PaleObject 引用，方便查找
        (child._threeObject as any).__paleObject = child;
    }

    public remove(child: PaleObject): void {
        this._threeObject.remove(child._threeObject);
        delete (child._threeObject as any).__paleObject;
    }

    public traverse(callback: (object: PaleObject) => void): void {
        this._threeObject.traverse((threeObj) => {
            const paleObj = (threeObj as any).__paleObject;
            if (paleObj) {
                callback(paleObj);
            }
        });
    }

    public clone(): PaleObject {
        const clonedThree = this._threeObject.clone();
        const cloned = new PaleObject(clonedThree, this._name);
        
        for (const _component of this._components) {

        }
        
        return cloned;
    }

    /**
     * 销毁对象
     */
    public dispose(): void {
        // 销毁所有组件
        for (const component of this._components) {
            if (component.enabled) {
                component.OnDisable();
            }
            component.OnDestroy();
        }
        this._components.length = 0;

        // 从父对象移除
        if (this._threeObject.parent) {
            this._threeObject.parent.remove(this._threeObject);
        }

        // 清理 Three.js 对象
        this._threeObject.clear();
    }
}



