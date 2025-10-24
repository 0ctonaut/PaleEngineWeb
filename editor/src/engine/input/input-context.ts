import { InputContextConfig, InputEvent } from './types';

export class InputContext {
  private config: InputContextConfig;
  private enabled: boolean = true;
  private managers: Set<any> = new Set(); // 使用 any 避免循环依赖
  private isActive: boolean = false;
  
  constructor(config: InputContextConfig) {
    this.config = { ...config };
  }
  
  // ========== 启用/禁用 ==========
  
  /**
   * 启用上下文
   */
  public enable(): void {
    this.enabled = true;
  }
  
  /**
   * 禁用上下文
   */
  public disable(): void {
    this.enabled = false;
  }
  
  /**
   * 检查是否启用
   */
  public isEnabled(): boolean {
    return this.enabled;
  }
  
  // ========== 优先级管理 ==========
  
  /**
   * 获取优先级
   */
  public getPriority(): number {
    return this.config.priority;
  }
  
  /**
   * 设置优先级
   */
  public setPriority(priority: number): void {
    this.config.priority = priority;
  }
  
  /**
   * 检查是否为独占模式
   */
  public isExclusive(): boolean {
    return this.config.exclusive || false;
  }
  
  /**
   * 设置独占模式
   */
  public setExclusive(exclusive: boolean): void {
    this.config.exclusive = exclusive;
  }
  
  /**
   * 检查是否阻止事件传播
   */
  public shouldBlockPropagation(): boolean {
    return this.config.blockPropagation || false;
  }
  
  /**
   * 设置是否阻止事件传播
   */
  public setBlockPropagation(block: boolean): void {
    this.config.blockPropagation = block;
  }
  
  // ========== Manager 关联 ==========
  
  /**
   * 添加关联的 LocalInputManager
   */
  public addManager(manager: any): void {
    this.managers.add(manager);
  }
  
  /**
   * 移除关联的 LocalInputManager
   */
  public removeManager(manager: any): void {
    this.managers.delete(manager);
  }
  
  /**
   * 获取所有关联的 Manager
   */
  public getManagers(): any[] {
    return Array.from(this.managers);
  }
  
  /**
   * 清空所有关联的 Manager
   */
  public clearManagers(): void {
    this.managers.clear();
  }
  
  // ========== 事件过滤 ==========
  
  /**
   * 检查是否应该接收事件
   */
  public shouldReceiveEvent(_event: InputEvent): boolean {
    if (!this.enabled || !this.isActive) {
      return false;
    }
    
    // 如果上下文是独占模式,只有最高优先级的上下文能接收事件
    if (this.config.exclusive) {
      // 这里需要从 GlobalInputManager 获取当前最高优先级上下文
      // 暂时返回 true,实际实现中需要更复杂的逻辑
      return true;
    }
    
    return true;
  }
  
  // ========== 激活/停用 ==========
  
  /**
   * 激活上下文(推入栈顶)
   */
  public activate(): void {
    this.isActive = true;
    // 通知 GlobalInputManager 更新上下文栈
    const globalManager = (globalThis as any).GlobalInputManager?.getInstance?.();
    if (globalManager) {
      globalManager.pushContext(this);
    }
  }
  
  /**
   * 停用上下文(从栈中移除)
   */
  public deactivate(): void {
    this.isActive = false;
    // 通知 GlobalInputManager 移除上下文
    const globalManager = (globalThis as any).GlobalInputManager?.getInstance?.();
    if (globalManager) {
      globalManager.popContext(this);
    }
  }
  
  public isActivated(): boolean {
    return this.isActive;
  }
  
  // ========== 配置管理 ==========
  
  public getName(): string {
    return this.config.name;
  }
  
  public updateConfig(newConfig: Partial<InputContextConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
  
  public getConfig(): InputContextConfig {
    return { ...this.config };
  }
  
  // ========== 调试和状态 ==========
  
  /**
   * 获取上下文状态信息
   */
  public getStatus(): {
    name: string;
    priority: number;
    enabled: boolean;
    active: boolean;
    exclusive: boolean;
    blockPropagation: boolean;
    managerCount: number;
  } {
    return {
      name: this.config.name,
      priority: this.config.priority,
      enabled: this.enabled,
      active: this.isActive,
      exclusive: this.config.exclusive || false,
      blockPropagation: this.config.blockPropagation || false,
      managerCount: this.managers.size
    };
  }
  
  /**
   * 销毁上下文
   */
  public dispose(): void {
    this.deactivate();
    this.clearManagers();
    this.enabled = false;
  }
}
