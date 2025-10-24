import { InputContextConfig, InputEvent } from './types';

export class InputContext {
  private config: InputContextConfig;
  private enabled: boolean = true;
  private managers: Set<any> = new Set(); // Use any to avoid circular dependency
  private isActive: boolean = false;
  
  constructor(config: InputContextConfig) {
    this.config = { ...config };
  }
  
  // ========== Enable/Disable ==========
  
  /**
   * Enable context
   */
  public enable(): void {
    this.enabled = true;
  }
  
  /**
   * Disable context
   */
  public disable(): void {
    this.enabled = false;
  }
  
  /**
   * Check if enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }
  
  // ========== Priority Management ==========
  
  /**
   * Get priority
   */
  public getPriority(): number {
    return this.config.priority;
  }
  
  /**
   * Set priority
   */
  public setPriority(priority: number): void {
    this.config.priority = priority;
  }
  
  /**
   * Check if exclusive mode
   */
  public isExclusive(): boolean {
    return this.config.exclusive || false;
  }
  
  /**
   * Set exclusive mode
   */
  public setExclusive(exclusive: boolean): void {
    this.config.exclusive = exclusive;
  }
  
  /**
   * Check if should block event propagation
   */
  public shouldBlockPropagation(): boolean {
    return this.config.blockPropagation || false;
  }
  
  /**
   * Set whether to block event propagation
   */
  public setBlockPropagation(block: boolean): void {
    this.config.blockPropagation = block;
  }
  
  // ========== Manager Association ==========
  
  /**
   * Add associated LocalInputManager
   */
  public addManager(manager: any): void {
    this.managers.add(manager);
  }
  
  /**
   * Remove associated LocalInputManager
   */
  public removeManager(manager: any): void {
    this.managers.delete(manager);
  }
  
  /**
   * Get all associated Managers
   */
  public getManagers(): any[] {
    return Array.from(this.managers);
  }
  
  /**
   * Clear all associated Managers
   */
  public clearManagers(): void {
    this.managers.clear();
  }
  
  // ========== Event Filtering ==========
  
  /**
   * Check if should receive event
   */
  public shouldReceiveEvent(_event: InputEvent): boolean {
    if (!this.enabled || !this.isActive) {
      return false;
    }
    
    // If context is exclusive, only the highest priority context can receive events
    if (this.config.exclusive) {
      // Need to get current highest priority context from GlobalInputManager
      // Return true for now, actual implementation needs more complex logic
      return true;
    }
    
    return true;
  }
  
  // ========== Activation/Deactivation ==========
  
  /**
   * Activate context (push to stack top)
   */
  public activate(): void {
    this.isActive = true;
    // Notify GlobalInputManager to update context stack
    const globalManager = (globalThis as any).GlobalInputManager?.getInstance?.();
    if (globalManager) {
      globalManager.pushContext(this);
    }
  }
  
  /**
   * Deactivate context (remove from stack)
   */
  public deactivate(): void {
    this.isActive = false;
    // Notify GlobalInputManager to remove context
    const globalManager = (globalThis as any).GlobalInputManager?.getInstance?.();
    if (globalManager) {
      globalManager.popContext(this);
    }
  }
  
  public isActivated(): boolean {
    return this.isActive;
  }
  
  // ========== Configuration Management ==========
  
  public getName(): string {
    return this.config.name;
  }
  
  public updateConfig(newConfig: Partial<InputContextConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
  
  public getConfig(): InputContextConfig {
    return { ...this.config };
  }
  
  // ========== Debug and Status ==========
  
  /**
   * Get context status information
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
   * Dispose context
   */
  public dispose(): void {
    this.deactivate();
    this.clearManagers();
    this.enabled = false;
  }
}
