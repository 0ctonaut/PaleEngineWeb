import { Scene, Color } from 'three/webgpu';
import { PaleObject } from './pale-object';
import { ComponentManager } from '../components/component-manager';

export class PaleScene {
    private readonly _threeScene: Scene;
    private readonly _objects: Set<PaleObject> = new Set();
    private readonly _componentManager: ComponentManager;

    constructor(backgroundColor: string | number = 'dimgray') {
        this._threeScene = new Scene();
        if (backgroundColor !== null) {
            this._threeScene.background = new Color(backgroundColor);
        }
        this._componentManager = new ComponentManager();
    }

    public getThreeScene(): Scene {
        return this._threeScene;
    }

    public getComponentManager(): ComponentManager {
        return this._componentManager;
    }

    public add(object: PaleObject): void {
        if (this._objects.has(object)) {
            console.warn(`Object ${object.name} is already in the scene`);
            return;
        }

        this._objects.add(object);
        this._threeScene.add(object.getThreeObject());

        // 注册对象的所有组件
        const components = object.getAllComponents();
        for (const component of components) {
            this._componentManager.registerComponent(component);
        }

        // 递归处理子对象
        object.traverse((child) => {
            if (child !== object) {
                const childComponents = child.getAllComponents();
                for (const component of childComponents) {
                    this._componentManager.registerComponent(component);
                }
            }
        });
    }

    /**
     * 从场景移除对象
     * 自动注销对象的所有组件
     */
    public remove(object: PaleObject): void {
        if (!this._objects.has(object)) {
            console.warn(`Object ${object.name} is not in the scene`);
            return;
        }

        // 注销对象的所有组件
        const components = object.getAllComponents();
        for (const component of components) {
            this._componentManager.unregisterComponent(component);
        }

        // 递归处理子对象
        object.traverse((child) => {
            if (child !== object) {
                const childComponents = child.getAllComponents();
                for (const component of childComponents) {
                    this._componentManager.unregisterComponent(component);
                }
            }
        });

        this._objects.delete(object);
        this._threeScene.remove(object.getThreeObject());
    }

    /**
     * 获取所有对象
     */
    public getObjects(): PaleObject[] {
        return Array.from(this._objects);
    }

    /**
     * 清空场景
     */
    public clear(): void {
        // 移除所有对象（会自动注销组件）
        const objects = Array.from(this._objects);
        for (const object of objects) {
            this.remove(object);
        }
        
        this._objects.clear();
        this._threeScene.clear();
    }

    /**
     * 更新场景（调用 ComponentManager 的更新）
     * @param deltaTime - 距离上一帧的时间（秒）
     */
    public update(deltaTime: number): void {
        this._componentManager.update(deltaTime);
    }

    /**
     * 重置场景（重置 ComponentManager 状态）
     */
    public reset(): void {
        this._componentManager.reset();
    }
}


