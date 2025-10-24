import { InputEvent, EventHandler, DragConfig, Position, EventTypes, MouseButton } from './types';
import { InputContext } from './input-context';
import { GlobalInputManager } from './global-input-manager';

/**
 * Local Input Manager - bound to specific DOM element
 */
export class LocalInputManager {
  private element: HTMLElement;
  private context: InputContext;
  private listeners: Map<string, Set<EventHandler>> = new Map();
  private parent: LocalInputManager | null = null;
  private children: Set<LocalInputManager> = new Set();
  
  // Drag state
  private _isDragging: boolean = false;
  private dragStartPos: Position | null = null;
  private dragConfig: DragConfig;
  private lastMousePos: Position = { x: 0, y: 0 };
  private dragButtons: Set<number> = new Set();
  
  // Hover state
  private _isHovering: boolean = false;
  private hoveredElement: HTMLElement | null = null;
  
  // Event listeners
  private boundHandlers: Map<string, EventListener> = new Map();
  
  // Global manager reference
  private globalManager: GlobalInputManager;
  
  constructor(
    element: HTMLElement,
    context: InputContext,
    options?: {
      parent?: LocalInputManager;
      dragConfig?: DragConfig;
    }
  ) {
    this.element = element;
    this.context = context;
    this.dragConfig = {
      threshold: 5,
      button: MouseButton.LEFT,
      ...options?.dragConfig
    };
    
    // 初始化拖拽按钮集合
    this.updateDragButtons();
    
    // 设置父子关系
    if (options?.parent) {
      this.setParent(options.parent);
    }
    
    // 获取全局管理器
    this.globalManager = GlobalInputManager.getInstance();
    
    // 注册到全局管理器和上下文
    this.globalManager.registerLocalManager(this);
    this.context.addManager(this);
    
    // 绑定事件监听器
    this.bindEventListeners();
  }
  
  // ========== 拖拽按钮管理 ==========
  
  /**
   * 更新拖拽按钮集合
   */
  private updateDragButtons(): void {
    this.dragButtons.clear();
    if (Array.isArray(this.dragConfig.button)) {
      this.dragButtons = new Set(this.dragConfig.button);
    } else if (typeof this.dragConfig.button === 'number') {
      this.dragButtons.add(this.dragConfig.button);
    }
  }
  
  /**
   * 检查按钮是否支持拖拽
   */
  private isDragButton(button: number): boolean {
    return this.dragButtons.has(button);
  }

  // ========== 事件订阅系统 ==========
  
  /**
   * 订阅事件
   */
  public on(event: string, handler: EventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }
  
  /**
   * 取消订阅事件
   */
  public off(event: string, handler: EventHandler): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }
  
  /**
   * 一次性事件订阅
   */
  public once(event: string, handler: EventHandler): void {
    const onceHandler = (e: InputEvent) => {
      handler(e);
      this.off(event, onceHandler);
    };
    this.on(event, onceHandler);
  }
  
  /**
   * 触发事件
   */
  private emitEvent(event: InputEvent): void {
    if (!this.context.isEnabled()) return;
    
    // 1. 触发当前管理器的监听器
    const handlers = this.listeners.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        handler(event);
        if (event.isPropagationStopped) break;
      }
    }
    
    // 2. 如果未停止冒泡且未阻止传播,传递给父管理器
    if (!event.isPropagationStopped && !this.context.shouldBlockPropagation() && this.parent) {
      this.parent.emitEvent(event);
    }
  }
  
  // ========== 事件监听器绑定 ==========
  
  /**
   * 绑定事件监听器
   */
  private bindEventListeners(): void {
    // 鼠标事件
    this.addElementListener(EventTypes.MOUSE_DOWN, this.handleMouseDown.bind(this));
    this.addElementListener(EventTypes.MOUSE_UP, this.handleMouseUp.bind(this));
    this.addElementListener(EventTypes.MOUSE_MOVE, this.handleMouseMove.bind(this));
    this.addElementListener(EventTypes.CLICK, this.handleClick.bind(this));
    this.addElementListener(EventTypes.DOUBLE_CLICK, this.handleDoubleClick.bind(this));
    this.addElementListener(EventTypes.CONTEXT_MENU, this.handleContextMenu.bind(this));
    this.addElementListener(EventTypes.WHEEL, this.handleWheel.bind(this));
    
    // 悬停事件
    this.addElementListener(EventTypes.MOUSE_ENTER, this.handleMouseEnter.bind(this));
    this.addElementListener(EventTypes.MOUSE_LEAVE, this.handleMouseLeave.bind(this));
    this.addElementListener(EventTypes.MOUSE_OVER, this.handleMouseOver.bind(this));
    this.addElementListener(EventTypes.MOUSE_OUT, this.handleMouseOut.bind(this));
    
    // 键盘事件
    this.addElementListener(EventTypes.KEY_DOWN, this.handleKeyDown.bind(this));
    this.addElementListener(EventTypes.KEY_UP, this.handleKeyUp.bind(this));
    
    // 触摸事件
    this.addElementListener(EventTypes.TOUCH_START, this.handleTouchStart.bind(this));
    this.addElementListener(EventTypes.TOUCH_MOVE, this.handleTouchMove.bind(this));
    this.addElementListener(EventTypes.TOUCH_END, this.handleTouchEnd.bind(this));
    this.addElementListener(EventTypes.TOUCH_CANCEL, this.handleTouchCancel.bind(this));
    
    // 焦点事件
    this.addElementListener(EventTypes.FOCUS, this.handleFocus.bind(this));
    this.addElementListener(EventTypes.BLUR, this.handleBlur.bind(this));
  }
  
  /**
   * 添加元素事件监听器
   */
  private addElementListener(eventType: string, handler: EventListener): void {
    this.element.addEventListener(eventType, handler, { passive: false });
    this.boundHandlers.set(eventType, handler);
  }
  
  /**
   * 移除元素事件监听器
   */
  private removeElementListener(eventType: string): void {
    const handler = this.boundHandlers.get(eventType);
    if (handler) {
      this.element.removeEventListener(eventType, handler);
      this.boundHandlers.delete(eventType);
    }
  }
  
  // ========== 事件处理器 ==========
  
  private handleMouseDown(e: Event): void {
    const mouseEvent = e as MouseEvent;
    if (this.isDragButton(mouseEvent.button)) {
      this.dragStartPos = this.getRelativePosition(mouseEvent.clientX, mouseEvent.clientY);
    }
    
    this.emitInputEvent(EventTypes.MOUSE_DOWN, e);
  }
  
  private handleMouseUp(e: Event): void {
    if (this._isDragging) {
      this._isDragging = false;
      this.emitInputEvent(EventTypes.DRAG_END, e);
    }
    this.dragStartPos = null;
    
    this.emitInputEvent(EventTypes.MOUSE_UP, e);
  }
  
  private handleMouseMove(e: Event): void {
    const mouseEvent = e as MouseEvent;
    const currentPos = this.getRelativePosition(mouseEvent.clientX, mouseEvent.clientY);
    
    // 检查是否开始拖拽（需要检查当前按下的按钮是否支持拖拽）
    if (this.dragStartPos && !this._isDragging && this.isDragButton(mouseEvent.button)) {
      const distance = Math.hypot(
        currentPos.x - this.dragStartPos.x,
        currentPos.y - this.dragStartPos.y
      );
      
      if (distance > this.dragConfig.threshold!) {
        this._isDragging = true;
        this.emitInputEvent(EventTypes.DRAG_START, e);
      }
    }
    
    // 拖拽中
    if (this._isDragging) {
      this.emitInputEvent(EventTypes.DRAG, e);
    }
    
    this.lastMousePos = currentPos;
    this.emitInputEvent(EventTypes.MOUSE_MOVE, e);
  }
  
  private handleClick(e: Event): void {
    this.emitInputEvent(EventTypes.CLICK, e);
  }
  
  private handleDoubleClick(e: Event): void {
    this.emitInputEvent(EventTypes.DOUBLE_CLICK, e);
  }
  
  private handleContextMenu(e: Event): void {
    this.emitInputEvent(EventTypes.CONTEXT_MENU, e);
  }
  
  private handleWheel(e: Event): void {
    this.emitInputEvent(EventTypes.WHEEL, e);
  }
  
  private handleMouseEnter(e: Event): void {
    this._isHovering = true;
    this.emitInputEvent(EventTypes.MOUSE_ENTER, e);
  }
  
  private handleMouseLeave(e: Event): void {
    this._isHovering = false;
    this.emitInputEvent(EventTypes.MOUSE_LEAVE, e);
  }
  
  private handleMouseOver(e: Event): void {
    const mouseEvent = e as MouseEvent;
    this.hoveredElement = mouseEvent.target as HTMLElement;
    this.emitInputEvent(EventTypes.MOUSE_OVER, e);
  }
  
  private handleMouseOut(e: Event): void {
    this.hoveredElement = null;
    this.emitInputEvent(EventTypes.MOUSE_OUT, e);
  }
  
  private handleKeyDown(e: Event): void {
    this.emitInputEvent(EventTypes.KEY_DOWN, e);
  }
  
  private handleKeyUp(e: Event): void {
    this.emitInputEvent(EventTypes.KEY_UP, e);
  }
  
  private handleTouchStart(e: Event): void {
    const touchEvent = e as TouchEvent;
    // 将触摸事件映射为鼠标事件
    if (touchEvent.touches.length > 0) {
      const touch = touchEvent.touches[0];
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY,
        button: 0
      });
      this.handleMouseDown(mouseEvent);
    }
  }
  
  private handleTouchMove(e: Event): void {
    const touchEvent = e as TouchEvent;
    if (touchEvent.touches.length > 0) {
      const touch = touchEvent.touches[0];
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      this.handleMouseMove(mouseEvent);
    }
  }
  
  private handleTouchEnd(e: Event): void {
    const touchEvent = e as TouchEvent;
    if (touchEvent.changedTouches.length > 0) {
      const touch = touchEvent.changedTouches[0];
      const mouseEvent = new MouseEvent('mouseup', {
        clientX: touch.clientX,
        clientY: touch.clientY,
        button: 0
      });
      this.handleMouseUp(mouseEvent);
    }
  }
  
  private handleTouchCancel(e: Event): void {
    this.handleTouchEnd(e);
  }
  
  private handleFocus(e: Event): void {
    this.emitInputEvent(EventTypes.FOCUS, e);
  }
  
  private handleBlur(e: Event): void {
    this.emitInputEvent(EventTypes.BLUR, e);
  }
  
  // ========== 坐标转换 ==========
  
  /**
   * 获取相对元素坐标
   */
  private getRelativePosition(clientX: number, clientY: number): Position {
    const rect = this.element.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }
  
  /**
   * 获取归一化设备坐标 (NDC)
   */
  private getNormalizedCoords(x: number, y: number): Position {
    const rect = this.element.getBoundingClientRect();
    return {
      x: (x / rect.width) * 2 - 1,
      y: -(y / rect.height) * 2 + 1
    };
  }
  
  /**
   * 创建标准化输入事件
   */
  private createInputEvent(type: string, originalEvent: Event): InputEvent {
    const mouseEvent = originalEvent as MouseEvent;
    const position = this.getRelativePosition(mouseEvent.clientX || 0, mouseEvent.clientY || 0);
    const normalizedPosition = this.getNormalizedCoords(position.x, position.y);
    
    let isPropagationStopped = false;
    
    return {
      type,
      originalEvent,
      position,
      globalPosition: { x: mouseEvent.clientX || 0, y: mouseEvent.clientY || 0 },
      normalizedPosition,
      delta: {
        x: position.x - this.lastMousePos.x,
        y: position.y - this.lastMousePos.y
      },
      button: mouseEvent.button,
      buttons: mouseEvent.buttons,
      key: (originalEvent as KeyboardEvent).key,
      ctrlKey: mouseEvent.ctrlKey || (originalEvent as KeyboardEvent).ctrlKey || false,
      shiftKey: mouseEvent.shiftKey || (originalEvent as KeyboardEvent).shiftKey || false,
      altKey: mouseEvent.altKey || (originalEvent as KeyboardEvent).altKey || false,
      metaKey: mouseEvent.metaKey || (originalEvent as KeyboardEvent).metaKey || false,
      target: originalEvent.target as HTMLElement,
      stopPropagation: () => { isPropagationStopped = true; },
      preventDefault: () => originalEvent.preventDefault(),
      isPropagationStopped
    };
  }
  
  /**
   * 发出输入事件
   */
  private emitInputEvent(type: string, originalEvent: Event): void {
    const inputEvent = this.createInputEvent(type, originalEvent);
    this.emitEvent(inputEvent);
  }
  
  // ========== 状态查询 ==========
  
  /**
   * 获取鼠标位置(相对元素)
   */
  public getMousePosition(): Position {
    return { ...this.lastMousePos };
  }
  
  /**
   * 获取归一化位置
   */
  public getNormalizedPosition(): Position {
    return this.getNormalizedCoords(this.lastMousePos.x, this.lastMousePos.y);
  }
  
  /**
   * 检查是否正在拖拽
   */
  public isDragging(): boolean {
    return this._isDragging;
  }
  
  /**
   * 检查是否悬停
   */
  public isHovering(): boolean {
    return this._isHovering;
  }
  
  /**
   * 获取悬停的元素
   */
  public getHoveredElement(): HTMLElement | null {
    return this.hoveredElement;
  }
  
  // ========== 层级管理 ==========
  
  /**
   * 设置父管理器
   */
  public setParent(parent: LocalInputManager | null): void {
    if (this.parent) {
      this.parent.children.delete(this);
    }
    
    this.parent = parent;
    
    if (parent) {
      parent.children.add(this);
    }
  }
  
  /**
   * 添加子管理器
   */
  public addChild(child: LocalInputManager): void {
    child.setParent(this);
  }
  
  /**
   * 移除子管理器
   */
  public removeChild(child: LocalInputManager): void {
    child.setParent(null);
  }
  
  /**
   * 获取父管理器
   */
  public getParent(): LocalInputManager | null {
    return this.parent;
  }
  
  /**
   * 获取所有子管理器
   */
  public getChildren(): LocalInputManager[] {
    return Array.from(this.children);
  }
  
  // ========== 上下文控制 ==========
  
  /**
   * 启用管理器
   */
  public enable(): void {
    this.context.enable();
  }
  
  /**
   * 禁用管理器
   */
  public disable(): void {
    this.context.disable();
  }
  
  /**
   * 检查是否启用
   */
  public isEnabled(): boolean {
    return this.context.isEnabled();
  }
  
  // ========== 全局事件处理 ==========
  
  /**
   * 处理全局事件(由 GlobalInputManager 调用)
   */
  public handleGlobalEvent(_event: Event): void {
    // 这里可以处理来自全局的事件
    // 例如键盘事件等
  }
  
  /**
   * 检查是否应该接收事件
   */
  public shouldReceiveEvent(event: Event): boolean {
    // 检查事件是否发生在当前元素内
    if (event.target && this.element.contains(event.target as Node)) {
      return true;
    }
    
    // 对于全局事件(如键盘),总是接收
    if (event instanceof KeyboardEvent) {
      return true;
    }
    
    return false;
  }
  
  // ========== 清理 ==========
  
  /**
   * 销毁管理器
   */
  public dispose(): void {
    // 移除所有事件监听器
    for (const [eventType] of this.boundHandlers) {
      this.removeElementListener(eventType);
    }
    this.boundHandlers.clear();
    
    // 清理子管理器
    for (const child of this.children) {
      child.dispose();
    }
    this.children.clear();
    
    // 从父管理器移除
    if (this.parent) {
      this.parent.children.delete(this);
    }
    
    // 从全局管理器和上下文注销
    this.globalManager.unregisterLocalManager(this);
    this.context.removeManager(this);
    
    // 清理监听器
    this.listeners.clear();
  }
}
