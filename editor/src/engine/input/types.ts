// Input event interface
export interface InputEvent {
  type: string;
  originalEvent: Event;
  position: { x: number; y: number };           // Relative element coordinates
  globalPosition: { x: number; y: number };     // Global screen coordinates
  normalizedPosition: { x: number; y: number }; // NDC (-1 to +1)
  delta?: { x: number; y: number };
  button?: number;
  buttons?: number;                              // Multi-button state
  key?: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  target?: HTMLElement;
  stopPropagation: () => void;                   // Stop event propagation
  preventDefault: () => void;
  isPropagationStopped: boolean;                 // Internal state flag
}

// Event handler type
export type EventHandler = (event: InputEvent) => void;

// Input context configuration
export interface InputContextConfig {
  name: string;
  priority: number;          // Priority (higher number = higher priority)
  exclusive?: boolean;       // Exclusive mode (blocks lower priority contexts)
  blockPropagation?: boolean; // Block event propagation
}

// Drag configuration
export interface DragConfig {
  threshold?: number;        // Drag threshold (pixels)
  button?: number | number[]; // Button(s) that trigger drag (default 0=left), supports multiple buttons
}

// Position interface
export interface Position {
  x: number;
  y: number;
}

// Mouse button enumeration
export enum MouseButton {
  LEFT = 0,
  MIDDLE = 1,
  RIGHT = 2,
  BACK = 3,
  FORWARD = 4
}

// Common keyboard key constants
export const Keys = {
  // Letter keys
  A: 'KeyA', B: 'KeyB', C: 'KeyC', D: 'KeyD', E: 'KeyE', F: 'KeyF',
  G: 'KeyG', H: 'KeyH', I: 'KeyI', J: 'KeyJ', K: 'KeyK', L: 'KeyL',
  M: 'KeyM', N: 'KeyN', O: 'KeyO', P: 'KeyP', Q: 'KeyQ', R: 'KeyR',
  S: 'KeyS', T: 'KeyT', U: 'KeyU', V: 'KeyV', W: 'KeyW', X: 'KeyX',
  Y: 'KeyY', Z: 'KeyZ',
  
  // Number keys
  DIGIT_0: 'Digit0', DIGIT_1: 'Digit1', DIGIT_2: 'Digit2', DIGIT_3: 'Digit3',
  DIGIT_4: 'Digit4', DIGIT_5: 'Digit5', DIGIT_6: 'Digit6', DIGIT_7: 'Digit7',
  DIGIT_8: 'Digit8', DIGIT_9: 'Digit9',
  
  // Function keys
  F1: 'F1', F2: 'F2', F3: 'F3', F4: 'F4', F5: 'F5', F6: 'F6',
  F7: 'F7', F8: 'F8', F9: 'F9', F10: 'F10', F11: 'F11', F12: 'F12',
  
  // Special keys
  SPACE: 'Space',
  ENTER: 'Enter',
  ESCAPE: 'Escape',
  BACKSPACE: 'Backspace',
  DELETE: 'Delete',
  TAB: 'Tab',
  CAPS_LOCK: 'CapsLock',
  SHIFT_LEFT: 'ShiftLeft',
  SHIFT_RIGHT: 'ShiftRight',
  CTRL_LEFT: 'ControlLeft',
  CTRL_RIGHT: 'ControlRight',
  ALT_LEFT: 'AltLeft',
  ALT_RIGHT: 'AltRight',
  META_LEFT: 'MetaLeft',
  META_RIGHT: 'MetaRight',
  
  // Arrow keys
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  
  // Others
  SEMICOLON: 'Semicolon',
  EQUAL: 'Equal',
  COMMA: 'Comma',
  MINUS: 'Minus',
  PERIOD: 'Period',
  SLASH: 'Slash',
  BACKQUOTE: 'Backquote',
  BRACKET_LEFT: 'BracketLeft',
  BACKSLASH: 'Backslash',
  BRACKET_RIGHT: 'BracketRight',
  QUOTE: 'Quote'
} as const;

// Event type constants
export const EventTypes = {
  // Mouse events
  MOUSE_DOWN: 'mousedown',
  MOUSE_UP: 'mouseup',
  MOUSE_MOVE: 'mousemove',
  MOUSE_ENTER: 'mouseenter',
  MOUSE_LEAVE: 'mouseleave',
  MOUSE_OVER: 'mouseover',
  MOUSE_OUT: 'mouseout',
  CLICK: 'click',
  DOUBLE_CLICK: 'dblclick',
  CONTEXT_MENU: 'contextmenu',
  WHEEL: 'wheel',
  
  // Drag events
  DRAG_START: 'dragstart',
  DRAG: 'drag',
  DRAG_END: 'dragend',
  
  // Hover events
  HOVER: 'hover',
  HOVER_ENTER: 'hoverenter',
  HOVER_LEAVE: 'hoverleave',
  
  // Keyboard events
  KEY_DOWN: 'keydown',
  KEY_UP: 'keyup',
  KEY_PRESS: 'keypress',
  
  // Touch events
  TOUCH_START: 'touchstart',
  TOUCH_MOVE: 'touchmove',
  TOUCH_END: 'touchend',
  TOUCH_CANCEL: 'touchcancel',
  
  // Focus events
  FOCUS: 'focus',
  BLUR: 'blur',
  FOCUS_IN: 'focusin',
  FOCUS_OUT: 'focusout'
} as const;
