import { Position, Keys } from './types';

export class GlobalInputManager {
  private static instance: GlobalInputManager | null = null;
  
  private keyStates: Map<string, boolean> = new Map();
  private mouseButtons: Map<number, boolean> = new Map();
  private mousePosition: Position = { x: 0, y: 0 };
  private lastMousePosition: Position = { x: 0, y: 0 };
  
  // Registry
  private localManagers: Set<any> = new Set();
  
  private contextStack: any[] = [];
  
  // Global event subscribers (for components that need global events regardless of element)
  private globalSubscribers: Map<string, Set<(event: MouseEvent | KeyboardEvent | WheelEvent) => void>> = new Map();
  
  // Event listeners
  private boundKeyDownHandler: (e: KeyboardEvent) => void;
  private boundKeyUpHandler: (e: KeyboardEvent) => void;
  private boundMouseMoveHandler: (e: MouseEvent) => void;
  private boundMouseDownHandler: (e: MouseEvent) => void;
  private boundMouseUpHandler: (e: MouseEvent) => void;
  private boundWheelHandler: (e: WheelEvent) => void;
  
  private constructor() {
    // Bind event handlers
    this.boundKeyDownHandler = this.handleKeyDown.bind(this);
    this.boundKeyUpHandler = this.handleKeyUp.bind(this);
    this.boundMouseMoveHandler = this.handleMouseMove.bind(this);
    this.boundMouseDownHandler = this.handleMouseDown.bind(this);
    this.boundMouseUpHandler = this.handleMouseUp.bind(this);
    this.boundWheelHandler = this.handleWheel.bind(this);
    
    // Add global event listeners
    this.addGlobalListeners();
  }
  
  public static getInstance(): GlobalInputManager {
    if (!GlobalInputManager.instance) {
      GlobalInputManager.instance = new GlobalInputManager();
    }
    return GlobalInputManager.instance;
  }
  
  /**
   * Add global event listeners
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
   * Remove global event listeners
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
   * Handle keyboard events
   */
  private handleKeyDown(e: KeyboardEvent): void {
    this.keyStates.set(e.code, true);
    this.notifyGlobalSubscribers('keydown', e);
    this.distributeEvent(e);
  }
  
  private handleKeyUp(e: KeyboardEvent): void {
    this.keyStates.set(e.code, false);
    this.notifyGlobalSubscribers('keyup', e);
    this.distributeEvent(e);
  }
  public onGlobalKeyDown(handler: (e: KeyboardEvent) => void): () => void {
    return this.subscribeGlobalEvent('keydown', handler as (event: MouseEvent | KeyboardEvent | WheelEvent) => void);
  }

  public onGlobalKeyUp(handler: (e: KeyboardEvent) => void): () => void {
    return this.subscribeGlobalEvent('keyup', handler as (event: MouseEvent | KeyboardEvent | WheelEvent) => void);
  }

  
  /**
   * Handle mouse events
   */
  private handleMouseMove(e: MouseEvent): void {
    this.lastMousePosition = { ...this.mousePosition };
    this.mousePosition = { x: e.clientX, y: e.clientY };
    this.notifyGlobalSubscribers('mousemove', e);
    this.distributeEvent(e);
  }
  
  private handleMouseDown(e: MouseEvent): void {
    this.mouseButtons.set(e.button, true);
    this.notifyGlobalSubscribers('mousedown', e);
    this.distributeEvent(e);
  }
  
  private handleMouseUp(e: MouseEvent): void {
    this.mouseButtons.set(e.button, false);
    this.notifyGlobalSubscribers('mouseup', e);
    this.distributeEvent(e);
  }
  
  private handleWheel(e: WheelEvent): void {
    this.distributeEvent(e);
  }
  
  /**
   * Notify global subscribers
   */
  private notifyGlobalSubscribers(eventType: string, event: MouseEvent | KeyboardEvent | WheelEvent): void {
    const subscribers = this.globalSubscribers.get(eventType);
    if (subscribers) {
      for (const handler of subscribers) {
        handler(event);
      }
    }
  }
  
  /**
   * Distribute events
   */
  private distributeEvent(event: Event): void {
    // Distribute events to LocalInputManager in priority order
    const sortedManagers = Array.from(this.localManagers).sort((a, b) => {
      const aPriority = a.context?.getPriority() || 0;
      const bPriority = b.context?.getPriority() || 0;
      return bPriority - aPriority; // Higher priority first
    });
    
    for (const manager of sortedManagers) {
      if (manager.context?.isEnabled() && manager.shouldReceiveEvent?.(event)) {
        manager.handleGlobalEvent?.(event);
        // If current context is exclusive, stop distribution
        if (manager.context?.isExclusive?.()) {
          break;
        }
      }
    }
  }
  
  // ========== Keyboard State Query ==========
  
  /**
   * Check if key is pressed
   */
  public isKeyPressed(key: string): boolean {
    return this.keyStates.get(key) || false;
  }
  
  /**
   * Check if key was just pressed (current frame)
   */
  public isKeyDown(key: string): boolean {
    return this.keyStates.get(key) || false;
  }
  
  /**
   * Check if key combination is pressed
   */
  public isKeyComboPressed(keys: string[]): boolean {
    return keys.every(key => this.isKeyPressed(key));
  }
  
  /**
   * Check Ctrl combination
   */
  public isCtrlPressed(): boolean {
    return this.isKeyPressed(Keys.CTRL_LEFT) || this.isKeyPressed(Keys.CTRL_RIGHT);
  }
  
  /**
   * Check Shift combination
   */
  public isShiftPressed(): boolean {
    return this.isKeyPressed(Keys.SHIFT_LEFT) || this.isKeyPressed(Keys.SHIFT_RIGHT);
  }
  
  /**
   * Check Alt combination
   */
  public isAltPressed(): boolean {
    return this.isKeyPressed(Keys.ALT_LEFT) || this.isKeyPressed(Keys.ALT_RIGHT);
  }
  
  /**
   * Check Meta combination (Windows key/Cmd key)
   */
  public isMetaPressed(): boolean {
    return this.isKeyPressed(Keys.META_LEFT) || this.isKeyPressed(Keys.META_RIGHT);
  }
  
  // ========== Mouse State Query ==========
  
  /**
   * Check if mouse button is pressed
   */
  public isMouseButtonPressed(button: number): boolean {
    return this.mouseButtons.get(button) || false;
  }
  
  /**
   * Check if left mouse button is pressed
   */
  public isLeftMousePressed(): boolean {
    return this.isMouseButtonPressed(0);
  }
  
  /**
   * Check if right mouse button is pressed
   */
  public isRightMousePressed(): boolean {
    return this.isMouseButtonPressed(2);
  }
  
  /**
   * Check if middle mouse button is pressed
   */
  public isMiddleMousePressed(): boolean {
    return this.isMouseButtonPressed(1);
  }
  
  /**
   * Get global mouse position
   */
  public getGlobalMousePosition(): Position {
    return { ...this.mousePosition };
  }
  
  /**
   * Get mouse movement delta
   */
  public getMouseDelta(): Position {
    return {
      x: this.mousePosition.x - this.lastMousePosition.x,
      y: this.mousePosition.y - this.lastMousePosition.y
    };
  }
  
  // ========== Global Event Subscription ==========
  
  /**
   * Subscribe to global mouse move events
   * Returns an unsubscribe function
   */
  public onGlobalMouseMove(handler: (e: MouseEvent) => void): () => void {
    return this.subscribeGlobalEvent('mousemove', handler as (event: MouseEvent | KeyboardEvent | WheelEvent) => void);
  }
  
  /**
   * Subscribe to global mouse up events
   * Returns an unsubscribe function
   */
  public onGlobalMouseUp(handler: (e: MouseEvent) => void): () => void {
    return this.subscribeGlobalEvent('mouseup', handler as (event: MouseEvent | KeyboardEvent | WheelEvent) => void);
  }
  
  /**
   * Subscribe to global mouse down events
   * Returns an unsubscribe function
   */
  public onGlobalMouseDown(handler: (e: MouseEvent) => void): () => void {
    return this.subscribeGlobalEvent('mousedown', handler as (event: MouseEvent | KeyboardEvent | WheelEvent) => void);
  }
  
  /**
   * Generic global event subscription method
   */
  private subscribeGlobalEvent(
    eventType: string,
    handler: (event: MouseEvent | KeyboardEvent | WheelEvent) => void
  ): () => void {
    if (!this.globalSubscribers.has(eventType)) {
      this.globalSubscribers.set(eventType, new Set());
    }
    
    const subscribers = this.globalSubscribers.get(eventType)!;
    subscribers.add(handler);
    
    // Return unsubscribe function
    return () => {
      subscribers.delete(handler);
      if (subscribers.size === 0) {
        this.globalSubscribers.delete(eventType);
      }
    };
  }
  
  // ========== LocalManager Registration ==========
  
  /**
   * Register LocalInputManager
   */
  public registerLocalManager(manager: any): void {
    this.localManagers.add(manager);
  }
  
  /**
   * Unregister LocalInputManager
   */
  public unregisterLocalManager(manager: any): void {
    this.localManagers.delete(manager);
  }
  
  // ========== Context Management ==========
  
  /**
   * Push context to stack top
   */
  public pushContext(context: any): void {
    // Remove existing same context
    this.removeContext(context);
    
    // Insert at correct position by priority
    const insertIndex = this.contextStack.findIndex(ctx => ctx.getPriority() < context.getPriority());
    if (insertIndex === -1) {
      this.contextStack.push(context);
    } else {
      this.contextStack.splice(insertIndex, 0, context);
    }
  }
  
  /**
   * Remove context from stack
   */
  public popContext(context: any): void {
    this.removeContext(context);
  }
  
  /**
   * Remove context (internal method)
   */
  private removeContext(context: any): void {
    const index = this.contextStack.indexOf(context);
    if (index > -1) {
      this.contextStack.splice(index, 1);
    }
  }
  
  /**
   * Get current active context
   */
  public getActiveContext(): any | null {
    return this.contextStack.length > 0 ? this.contextStack[0] : null;
  }
  
  /**
   * Get all contexts
   */
  public getContextStack(): any[] {
    return [...this.contextStack];
  }
  
  // ========== Utility Methods ==========
  
  /**
   * Reset all states
   */
  public reset(): void {
    this.keyStates.clear();
    this.mouseButtons.clear();
    this.mousePosition = { x: 0, y: 0 };
    this.lastMousePosition = { x: 0, y: 0 };
  }
  
  /**
   * Dispose manager
   */
  public dispose(): void {
    this.removeGlobalListeners();
    this.globalSubscribers.clear();
    this.localManagers.clear();
    this.contextStack.length = 0;
    this.reset();
    GlobalInputManager.instance = null;
  }
}
