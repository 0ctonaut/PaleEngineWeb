import { MonoBehaviour } from './mono-behavior';

export class ComponentManager {
    private readonly _awakeComponents: Set<MonoBehaviour> = new Set();
    
    private readonly _startComponents: Set<MonoBehaviour> = new Set();
    
    private readonly _updateComponents: Set<MonoBehaviour> = new Set();
    
    private readonly _fixedUpdateComponents: Set<MonoBehaviour> = new Set();
    
    private readonly _lateUpdateComponents: Set<MonoBehaviour> = new Set();

    private readonly _fixedDeltaTime: number = 0.02;
    
    private _fixedUpdateAccumulator: number = 0;

    private _hasStarted: boolean = false;

    /**
     * 注册组件
     * 当对象添加到场景时，由 PaleScene 调用
     */
    public registerComponent(component: MonoBehaviour): void {
        if (!component.enabled) {
            return;
        }

        // 添加到 Awake 列表
        //this._awakeComponents.add(component);
        
        // 立即调用 Awake
        component.Awake();
        
        // 从 Awake 列表移除，添加到 Start 列表
        //this._awakeComponents.delete(component);
        this._startComponents.add(component);
        
        // 添加到更新列表
        this._updateComponents.add(component);
        this._fixedUpdateComponents.add(component);
        this._lateUpdateComponents.add(component);
    }

    /**
     * 注销组件
     * 当对象从场景移除时，由 PaleScene 调用
     */
    public unregisterComponent(component: MonoBehaviour): void {
        //this._awakeComponents.delete(component);
        this._startComponents.delete(component);
        this._updateComponents.delete(component);
        this._fixedUpdateComponents.delete(component);
        this._lateUpdateComponents.delete(component);
    }

    /**
     * 更新循环 - 每帧调用
     * @param deltaTime - 距离上一帧的时间（秒）
     */
    public update(deltaTime: number): void {
        // 第一次更新时，调用所有组件的 Start
        if (!this._hasStarted) {
            for (const component of this._startComponents) {
                if (component.enabled) {
                    component.Start();
                }
            }
            this._startComponents.clear();
            this._hasStarted = true;
        }

        // 调用 Update
        for (const component of this._updateComponents) {
            if (component.enabled) {
                component.Update(deltaTime);
            }
        }

        // 累积 FixedUpdate 时间
        this._fixedUpdateAccumulator += deltaTime;
        
        // 执行 FixedUpdate（固定时间步长）
        while (this._fixedUpdateAccumulator >= this._fixedDeltaTime) {
            for (const component of this._fixedUpdateComponents) {
                if (component.enabled) {
                    component.FixedUpdate(this._fixedDeltaTime);
                }
            }
            this._fixedUpdateAccumulator -= this._fixedDeltaTime;
        }

        // 调用 LateUpdate
        for (const component of this._lateUpdateComponents) {
            if (component.enabled) {
                component.LateUpdate(deltaTime);
            }
        }
    }

    public reset(): void {
        this._hasStarted = false;
        this._fixedUpdateAccumulator = 0;
        
        // 清空所有列表（组件会重新注册）
        this._awakeComponents.clear();
        this._startComponents.clear();
        this._updateComponents.clear();
        this._fixedUpdateComponents.clear();
        this._lateUpdateComponents.clear();
    }

    public getFixedDeltaTime(): number {
        return this._fixedDeltaTime;
    }

    public setFixedDeltaTime(value: number): void {
        if (value <= 0) {
            console.warn('FixedDeltaTime must be positive');
            return;
        }
        (this as any)._fixedDeltaTime = value;
    }
}


