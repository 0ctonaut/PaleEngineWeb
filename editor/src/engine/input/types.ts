// 输入事件接口
export interface InputEvent {
  type: string;
  originalEvent: Event;
  position: { x: number; y: number };           // 相对元素坐标
  globalPosition: { x: number; y: number };     // 全局屏幕坐标
  normalizedPosition: { x: number; y: number }; // NDC (-1 到 +1)
  delta?: { x: number; y: number };
  button?: number;
  buttons?: number;                              // 多按钮状态
  key?: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  target?: HTMLElement;
  stopPropagation: () => void;                   // 停止冒泡
  preventDefault: () => void;
  isPropagationStopped: boolean;                 // 内部状态标记
}

// 事件处理器类型
export type EventHandler = (event: InputEvent) => void;

// 输入上下文配置
export interface InputContextConfig {
  name: string;
  priority: number;          // 优先级(数字越大优先级越高)
  exclusive?: boolean;       // 独占模式(阻止低优先级上下文)
  blockPropagation?: boolean; // 阻止事件传播
}

// 拖拽配置
export interface DragConfig {
  threshold?: number;        // 拖拽阈值(像素)
  button?: number;          // 触发拖拽的按钮(默认0=左键)
}

// 坐标接口
export interface Position {
  x: number;
  y: number;
}

// 鼠标按钮枚举
export enum MouseButton {
  LEFT = 0,
  MIDDLE = 1,
  RIGHT = 2,
  BACK = 3,
  FORWARD = 4
}

// 常用键盘按键常量
export const Keys = {
  // 字母键
  A: 'KeyA', B: 'KeyB', C: 'KeyC', D: 'KeyD', E: 'KeyE', F: 'KeyF',
  G: 'KeyG', H: 'KeyH', I: 'KeyI', J: 'KeyJ', K: 'KeyK', L: 'KeyL',
  M: 'KeyM', N: 'KeyN', O: 'KeyO', P: 'KeyP', Q: 'KeyQ', R: 'KeyR',
  S: 'KeyS', T: 'KeyT', U: 'KeyU', V: 'KeyV', W: 'KeyW', X: 'KeyX',
  Y: 'KeyY', Z: 'KeyZ',
  
  // 数字键
  DIGIT_0: 'Digit0', DIGIT_1: 'Digit1', DIGIT_2: 'Digit2', DIGIT_3: 'Digit3',
  DIGIT_4: 'Digit4', DIGIT_5: 'Digit5', DIGIT_6: 'Digit6', DIGIT_7: 'Digit7',
  DIGIT_8: 'Digit8', DIGIT_9: 'Digit9',
  
  // 功能键
  F1: 'F1', F2: 'F2', F3: 'F3', F4: 'F4', F5: 'F5', F6: 'F6',
  F7: 'F7', F8: 'F8', F9: 'F9', F10: 'F10', F11: 'F11', F12: 'F12',
  
  // 特殊键
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
  
  // 方向键
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  
  // 其他
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

// 事件类型常量
export const EventTypes = {
  // 鼠标事件
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
  
  // 拖拽事件
  DRAG_START: 'dragstart',
  DRAG: 'drag',
  DRAG_END: 'dragend',
  
  // 悬停事件
  HOVER: 'hover',
  HOVER_ENTER: 'hoverenter',
  HOVER_LEAVE: 'hoverleave',
  
  // 键盘事件
  KEY_DOWN: 'keydown',
  KEY_UP: 'keyup',
  KEY_PRESS: 'keypress',
  
  // 触摸事件
  TOUCH_START: 'touchstart',
  TOUCH_MOVE: 'touchmove',
  TOUCH_END: 'touchend',
  TOUCH_CANCEL: 'touchcancel',
  
  // 焦点事件
  FOCUS: 'focus',
  BLUR: 'blur',
  FOCUS_IN: 'focusin',
  FOCUS_OUT: 'focusout'
} as const;
