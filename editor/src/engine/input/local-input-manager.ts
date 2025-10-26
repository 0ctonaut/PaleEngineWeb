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
    
    // Initialize drag button collection
    this.updateDragButtons();
    
    // Set parent-child relationship
    if (options?.parent) {
      this.setParent(options.parent);
    }
    
    // Get global manager
    this.globalManager = GlobalInputManager.getInstance();
    
    // Register to global manager and context
    this.globalManager.registerLocalManager(this);
    this.context.addManager(this);
    
    // Bind event listeners
    this.bindEventListeners();
  }
  
  // ========== Drag Button Management ==========
  
  /**
   * Update drag button collection
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
   * Check if button supports dragging
   */
  private isDragButton(button: number): boolean {
    return this.dragButtons.has(button);
  }

  // ========== Event Subscription System ==========
  
  /**
   * Subscribe to event
   */
  public on(event: string, handler: EventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }
  
  /**
   * Unsubscribe from event
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
   * One-time event subscription
   */
  public once(event: string, handler: EventHandler): void {
    const onceHandler = (e: InputEvent) => {
      handler(e);
      this.off(event, onceHandler);
    };
    this.on(event, onceHandler);
  }
  
  /**
   * Emit event
   */
  private emitEvent(event: InputEvent): void {
    if (!this.context.isEnabled()) return;
    
    // 1. Trigger listeners of current manager
    const handlers = this.listeners.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        handler(event);
        if (event.isPropagationStopped) break;
      }
    }
    
    // 2. If not stopped and not prevented, pass to parent manager
    if (!event.isPropagationStopped && !this.context.shouldBlockPropagation() && this.parent) {
      this.parent.emitEvent(event);
    }
  }
  
  // ========== Event Listener Binding ==========
  
  /**
   * Bind event listeners
   */
  private bindEventListeners(): void {
    // Mouse events
    this.addElementListener(EventTypes.MOUSE_DOWN, this.handleMouseDown.bind(this));
    this.addElementListener(EventTypes.MOUSE_UP, this.handleMouseUp.bind(this));
    this.addElementListener(EventTypes.MOUSE_MOVE, this.handleMouseMove.bind(this));
    this.addElementListener(EventTypes.CLICK, this.handleClick.bind(this));
    this.addElementListener(EventTypes.DOUBLE_CLICK, this.handleDoubleClick.bind(this));
    this.addElementListener(EventTypes.CONTEXT_MENU, this.handleContextMenu.bind(this));
    this.addElementListener(EventTypes.WHEEL, this.handleWheel.bind(this));
    
    // Hover events
    this.addElementListener(EventTypes.MOUSE_ENTER, this.handleMouseEnter.bind(this));
    this.addElementListener(EventTypes.MOUSE_LEAVE, this.handleMouseLeave.bind(this));
    this.addElementListener(EventTypes.MOUSE_OVER, this.handleMouseOver.bind(this));
    this.addElementListener(EventTypes.MOUSE_OUT, this.handleMouseOut.bind(this));
    
    // Keyboard events
    this.addElementListener(EventTypes.KEY_DOWN, this.handleKeyDown.bind(this));
    this.addElementListener(EventTypes.KEY_UP, this.handleKeyUp.bind(this));
    
    // Touch events
    this.addElementListener(EventTypes.TOUCH_START, this.handleTouchStart.bind(this));
    this.addElementListener(EventTypes.TOUCH_MOVE, this.handleTouchMove.bind(this));
    this.addElementListener(EventTypes.TOUCH_END, this.handleTouchEnd.bind(this));
    this.addElementListener(EventTypes.TOUCH_CANCEL, this.handleTouchCancel.bind(this));
    
    // Focus events
    this.addElementListener(EventTypes.FOCUS, this.handleFocus.bind(this));
    this.addElementListener(EventTypes.BLUR, this.handleBlur.bind(this));
  }
  
  /**
   * Add element event listener
   */
  private addElementListener(eventType: string, handler: EventListener): void {
    this.element.addEventListener(eventType, handler, { passive: false });
    this.boundHandlers.set(eventType, handler);
  }
  
  /**
   * Remove element event listener
   */
  private removeElementListener(eventType: string): void {
    const handler = this.boundHandlers.get(eventType);
    if (handler) {
      this.element.removeEventListener(eventType, handler);
      this.boundHandlers.delete(eventType);
    }
  }
  
  // ========== Event Handlers ==========
  
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
    
    // Check if dragging starts (need to check if currently pressed button supports dragging)
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
    
    // Dragging
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
    // Map touch events to mouse events
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
  
  // ========== Coordinate Conversion ==========
  
  /**
   * Get relative element coordinates
   */
  private getRelativePosition(clientX: number, clientY: number): Position {
    const rect = this.element.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }
  
  /**
   * Get normalized device coordinates (NDC)
   */
  private getNormalizedCoords(x: number, y: number): Position {
    const rect = this.element.getBoundingClientRect();
    return {
      x: (x / rect.width) * 2 - 1,
      y: -(y / rect.height) * 2 + 1
    };
  }
  
  /**
   * Create standardized input event
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
   * Emit input event
   */
  private emitInputEvent(type: string, originalEvent: Event): void {
    const inputEvent = this.createInputEvent(type, originalEvent);
    this.emitEvent(inputEvent);
  }
  
  // ========== State Queries ==========
  
  /**
   * Get mouse position (relative to element)
   */
  public getMousePosition(): Position {
    return { ...this.lastMousePos };
  }
  
  /**
   * Get normalized position
   */
  public getNormalizedPosition(): Position {
    return this.getNormalizedCoords(this.lastMousePos.x, this.lastMousePos.y);
  }
  
  /**
   * Check if currently dragging
   */
  public isDragging(): boolean {
    return this._isDragging;
  }
  
  /**
   * Check if hovering
   */
  public isHovering(): boolean {
    return this._isHovering;
  }
  
  /**
   * Get hovered element
   */
  public getHoveredElement(): HTMLElement | null {
    return this.hoveredElement;
  }
  
  // ========== Hierarchy Management ==========
  
  /**
   * Set parent manager
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
   * Add child manager
   */
  public addChild(child: LocalInputManager): void {
    child.setParent(this);
  }
  
  /**
   * Remove child manager
   */
  public removeChild(child: LocalInputManager): void {
    child.setParent(null);
  }
  
  /**
   * Get parent manager
   */
  public getParent(): LocalInputManager | null {
    return this.parent;
  }
  
  /**
   * Get all child managers
   */
  public getChildren(): LocalInputManager[] {
    return Array.from(this.children);
  }
  
  // ========== Context Control ==========
  
  /**
   * Enable manager
   */
  public enable(): void {
    this.context.enable();
  }
  
  /**
   * Disable manager
   */
  public disable(): void {
    this.context.disable();
  }
  
  /**
   * Check if enabled
   */
  public isEnabled(): boolean {
    return this.context.isEnabled();
  }
  
  // ========== Global Event Handling ==========
  
  /**
   * Handle global events (called by GlobalInputManager)
   */
  public handleGlobalEvent(_event: Event): void {
    // Handle events from global here
    // Such as keyboard events
  }
  
  /**
   * Check if should receive event
   */
  public shouldReceiveEvent(event: Event): boolean {
    // Check if event occurs within current element
    if (event.target && this.element.contains(event.target as Node)) {
      return true;
    }
    
    // For global events (like keyboard), always receive
    if (event instanceof KeyboardEvent) {
      return true;
    }
    
    return false;
  }
  
  // ========== Cleanup ==========
  
  /**
   * Destroy manager
   */
  public dispose(): void {
    // Remove all event listeners
    for (const [eventType] of this.boundHandlers) {
      this.removeElementListener(eventType);
    }
    this.boundHandlers.clear();
    
    // Clean up child managers
    for (const child of this.children) {
      child.dispose();
    }
    this.children.clear();
    
    // Remove from parent manager
    if (this.parent) {
      this.parent.children.delete(this);
    }
    
    // Unregister from global manager and context
    this.globalManager.unregisterLocalManager(this);
    this.context.removeManager(this);
    
    // Clean up listeners
    this.listeners.clear();
  }
}
