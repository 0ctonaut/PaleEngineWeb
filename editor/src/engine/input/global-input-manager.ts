import { Position, Keys } from './types';

export class GlobalInputManager {
  private static instance: GlobalInputManager | null = null;
  
  private keyStates: Map<string, boolean> = new Map();
  private mouseButtons: Map<number, boolean> = new Map();
  private mousePosition: Position = { x: 0, y: 0 };
  private lastMousePosition: Position = { x: 0, y: 0 };
  
  // 注册表
  private localManagers: Set<any> = new Set();
  
  private contextStack: any[] = [];
  
  // 事件监听器
  private boundKeyDownHandler: (e: KeyboardEvent) => void;
  private boundKeyUpHandler: (e: KeyboardEvent) => void;
  private boundMouseMoveHandler: (e: MouseEvent) => void;
  private boundMouseDownHandler: (e: MouseEvent) => void;
  private boundMouseUpHandler: (e: MouseEvent) => void;
  private boundWheelHandler: (e: WheelEvent) => void;
  
  private constructor() {
    // 绑定事件处理器
    this.boundKeyDownHandler = this.handleKeyDown.bind(this);
    this.boundKeyUpHandler = this.handleKeyUp.bind(this);
    this.boundMouseMoveHandler = this.handleMouseMove.bind(this);
    this.boundMouseDownHandler = this.handleMouseDown.bind(this);
    this.boundMouseUpHandler = this.handleMouseUp.bind(this);
    this.boundWheelHandler = this.handleWheel.bind(this);
    
    // 添加全局事件监听器
    this.addGlobalListeners();
  }
  
  public static getInstance(): GlobalInputManager {
    if (!GlobalInputManager.instance) {
      GlobalInputManager.instance = new GlobalInputManager();
    }
    return GlobalInputManager.instance;
  }
  
  /**
   * 添加全局事件监听器
   */
  private addGlobalListeners(): void {
    window.addEventListener('keydown', this.boundKeyDownHandler, { passive: false });
    window.addEventListener('keyup', this.boundKeyUpHandler, { passive: false });
    window.addEventListener('mousemove', this.boundMouseMoveHandler, { passive: true });
    window.addEventListener('mousedown', this.boundMouseDownHandler, { passive: false });
    window.addEventListener('mouseup', this.boundMouseUpHandler, { passive: false });
    window.addEventListener('wheel', this.boundWheelHandler, { passive: false });
  }
  
  /**
   * 移除全局事件监听器
   */
  private removeGlobalListeners(): void {
    window.removeEventListener('keydown', this.boundKeyDownHandler);
    window.removeEventListener('keyup', this.boundKeyUpHandler);
    window.removeEventListener('mousemove', this.boundMouseMoveHandler);
    window.removeEventListener('mousedown', this.boundMouseDownHandler);
    window.removeEventListener('mouseup', this.boundMouseUpHandler);
    window.removeEventListener('wheel', this.boundWheelHandler);
  }
  
  /**
   * 键盘事件处理
   */
  private handleKeyDown(e: KeyboardEvent): void {
    this.keyStates.set(e.code, true);
    this.distributeEvent(e);
  }
  
  private handleKeyUp(e: KeyboardEvent): void {
    this.keyStates.set(e.code, false);
    this.distributeEvent(e);
  }
  
  /**
   * 鼠标事件处理
   */
  private handleMouseMove(e: MouseEvent): void {
    this.lastMousePosition = { ...this.mousePosition };
    this.mousePosition = { x: e.clientX, y: e.clientY };
    this.distributeEvent(e);
  }
  
  private handleMouseDown(e: MouseEvent): void {
    this.mouseButtons.set(e.button, true);
    this.distributeEvent(e);
  }
  
  private handleMouseUp(e: MouseEvent): void {
    this.mouseButtons.set(e.button, false);
    this.distributeEvent(e);
  }
  
  private handleWheel(e: WheelEvent): void {
    this.distributeEvent(e);
  }
  
  /**
   * 事件分发
   */
  private distributeEvent(event: Event): void {
    // 按优先级顺序分发事件到 LocalInputManager
    const sortedManagers = Array.from(this.localManagers).sort((a, b) => {
      const aPriority = a.context?.getPriority() || 0;
      const bPriority = b.context?.getPriority() || 0;
      return bPriority - aPriority; // 高优先级在前
    });
    
    for (const manager of sortedManagers) {
      if (manager.context?.isEnabled() && manager.shouldReceiveEvent?.(event)) {
        manager.handleGlobalEvent?.(event);
        // 如果当前上下文是独占模式,停止分发
        if (manager.context?.isExclusive?.()) {
          break;
        }
      }
    }
  }
  
  // ========== 键盘状态查询 ==========
  
  /**
   * 检查按键是否被按下
   */
  public isKeyPressed(key: string): boolean {
    return this.keyStates.get(key) || false;
  }
  
  /**
   * 检查按键是否刚被按下(当前帧)
   */
  public isKeyDown(key: string): boolean {
    return this.keyStates.get(key) || false;
  }
  
  /**
   * 检查组合键是否被按下
   */
  public isKeyComboPressed(keys: string[]): boolean {
    return keys.every(key => this.isKeyPressed(key));
  }
  
  /**
   * 检查 Ctrl 组合键
   */
  public isCtrlPressed(): boolean {
    return this.isKeyPressed(Keys.CTRL_LEFT) || this.isKeyPressed(Keys.CTRL_RIGHT);
  }
  
  /**
   * 检查 Shift 组合键
   */
  public isShiftPressed(): boolean {
    return this.isKeyPressed(Keys.SHIFT_LEFT) || this.isKeyPressed(Keys.SHIFT_RIGHT);
  }
  
  /**
   * 检查 Alt 组合键
   */
  public isAltPressed(): boolean {
    return this.isKeyPressed(Keys.ALT_LEFT) || this.isKeyPressed(Keys.ALT_RIGHT);
  }
  
  /**
   * 检查 Meta 组合键(Windows 键/Cmd 键)
   */
  public isMetaPressed(): boolean {
    return this.isKeyPressed(Keys.META_LEFT) || this.isKeyPressed(Keys.META_RIGHT);
  }
  
  // ========== 鼠标状态查询 ==========
  
  /**
   * 检查鼠标按钮是否被按下
   */
  public isMouseButtonPressed(button: number): boolean {
    return this.mouseButtons.get(button) || false;
  }
  
  /**
   * 检查左键是否被按下
   */
  public isLeftMousePressed(): boolean {
    return this.isMouseButtonPressed(0);
  }
  
  /**
   * 检查右键是否被按下
   */
  public isRightMousePressed(): boolean {
    return this.isMouseButtonPressed(2);
  }
  
  /**
   * 检查中键是否被按下
   */
  public isMiddleMousePressed(): boolean {
    return this.isMouseButtonPressed(1);
  }
  
  /**
   * 获取全局鼠标位置
   */
  public getGlobalMousePosition(): Position {
    return { ...this.mousePosition };
  }
  
  /**
   * 获取鼠标移动增量
   */
  public getMouseDelta(): Position {
    return {
      x: this.mousePosition.x - this.lastMousePosition.x,
      y: this.mousePosition.y - this.lastMousePosition.y
    };
  }
  
  // ========== LocalManager 注册 ==========
  
  /**
   * 注册 LocalInputManager
   */
  public registerLocalManager(manager: any): void {
    this.localManagers.add(manager);
  }
  
  /**
   * 注销 LocalInputManager
   */
  public unregisterLocalManager(manager: any): void {
    this.localManagers.delete(manager);
  }
  
  // ========== 上下文管理 ==========
  
  /**
   * 推入上下文到栈顶
   */
  public pushContext(context: any): void {
    // 移除已存在的相同上下文
    this.removeContext(context);
    
    // 按优先级插入到正确位置
    const insertIndex = this.contextStack.findIndex(ctx => ctx.getPriority() < context.getPriority());
    if (insertIndex === -1) {
      this.contextStack.push(context);
    } else {
      this.contextStack.splice(insertIndex, 0, context);
    }
  }
  
  /**
   * 从栈中移除上下文
   */
  public popContext(context: any): void {
    this.removeContext(context);
  }
  
  /**
   * 移除上下文(内部方法)
   */
  private removeContext(context: any): void {
    const index = this.contextStack.indexOf(context);
    if (index > -1) {
      this.contextStack.splice(index, 1);
    }
  }
  
  /**
   * 获取当前活跃的上下文
   */
  public getActiveContext(): any | null {
    return this.contextStack.length > 0 ? this.contextStack[0] : null;
  }
  
  /**
   * 获取所有上下文
   */
  public getContextStack(): any[] {
    return [...this.contextStack];
  }
  
  // ========== 工具方法 ==========
  
  /**
   * 重置所有状态
   */
  public reset(): void {
    this.keyStates.clear();
    this.mouseButtons.clear();
    this.mousePosition = { x: 0, y: 0 };
    this.lastMousePosition = { x: 0, y: 0 };
  }
  
  /**
   * 销毁管理器
   */
  public dispose(): void {
    this.removeGlobalListeners();
    this.localManagers.clear();
    this.contextStack.length = 0;
    this.reset();
    GlobalInputManager.instance = null;
  }
}
