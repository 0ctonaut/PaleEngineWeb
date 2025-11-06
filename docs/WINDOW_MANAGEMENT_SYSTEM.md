# 窗口管理系统文档

## 概述

PaleEngine Editor 实现了一个类似 VS Code 或 Blender 的浮动窗口管理系统，支持窗口的拖拽、调整大小、聚焦管理等功能。窗口可以自由浮动在 workspace 区域内，支持嵌套的 split 和 tab 布局。

## 架构设计

### 页面结构

- **Top Bar**：固定在页面顶部的工具栏（现有 toolbar）
- **Workspace Area**：窗口区域，占据剩余空间，窗口在此区域内自由浮动
- 窗口完全独立，不依附任何固定布局

### 核心组件

#### 窗口管理组件 (`editor/src/ui/components/window/`)

1. **WindowManager** (`window-manager.ts`)
   - 管理 workspace 区域
   - 管理所有窗口的创建、删除
   - 管理窗口聚焦状态和 z-index
   - 提供 workspace 边界信息

2. **Window** (`window.ts`)
   - 窗口基础类，统一架构设计
   - 支持三种内容类型：
     - `'single'`：单一内容（Panel 或 Viewport），显示标题标签
     - `'split'`：分割布局，包含两个子 Window，不显示标题标签
     - `'tab'`：标签页布局，包含多个子 Window，不显示标题标签
   - 管理窗口的位置、大小和最小尺寸限制
   - 支持嵌套（子 Window 可以再次 split 或 tab）

3. **Panel** (`panel.ts`)
   - Window 的内容类型，用于 UI 类型的窗口内容（如 ProfilerPanel）

4. **Viewport** (`viewport.ts`)
   - Window 的内容类型，用于渲染类型的窗口内容（容纳 canvas）

#### 交互处理组件 (`editor/src/ui/components/interaction/`)

1. **WindowDragHandler** (`window-drag-handler.ts`)
   - 处理窗口标题标签拖拽逻辑
   - 使用全局事件订阅机制，确保拖拽流畅
   - 缓存 workspace 矩形，优化性能
   - 检测吸附区域（边缘、其他窗口）[待实现]
   - 处理标签页拖拽分离 [待实现]

2. **WindowResizeHandler** (`window-resize-handler.ts`)
   - 处理窗口边框拖拽调整大小
   - 支持 8 个方向的调整手柄（n, s, e, w, ne, nw, se, sw）
   - 使用全局事件订阅机制
   - 递归调整：当父级窗口改变大小时，所有子窗口按比例自动调整

3. **WindowContextMenu** (`window-context-menu.ts`)
   - 右键菜单组件
   - 仅在标题标签上触发（contentType === 'single' 时）
   - 提供关闭等操作选项

## 功能特性

### 1. 窗口基础结构

- **标题标签**（仅 `contentType === 'single'` 时显示）：
  - 左对齐，不占满宽度
  - 可拖拽
  - 支持右键菜单
  - 只有叶子节点（包含实际内容的 Window）才显示标题标签

- **内容区**：根据 contentType 显示不同内容
  - `single`：显示 Panel 或 Viewport
  - `split`：显示分割布局，包含两个子 Window
  - `tab`：显示标签页布局，包含多个子 Window

- **窗口样式**：参考 macOS 样式，使用 CSS 实现现代化外观

### 2. 拖拽系统

- **标题标签拖拽**：检测鼠标按下位置，开始拖拽（仅 `contentType === 'single'` 时）
- **全局事件处理**：使用 `GlobalInputManager` 订阅全局鼠标事件，确保在 workspace 范围内不会因经过其他 UI 元素而被打断
- **性能优化**：
  - 缓存 workspace 矩形，只在开始时获取一次
  - 拖拽时使用 CSS `transform` 代替 `left/top`，利用 GPU 加速
- **边界保护**：如果鼠标超出 workspace 范围，自动结束拖拽

### 3. 窗口调整大小

- **边框拖拽调整**：拖拽窗口边框改变窗口大小
- **8 个调整手柄**：支持 n, s, e, w, ne, nw, se, sw 八个方向
- **递归调整**：父级窗口大小改变时，所有子窗口按比例自动调整
- **全局事件处理**：使用全局事件订阅，确保调整过程流畅

### 4. 聚焦系统

- **点击聚焦**：点击窗口任何地方（标题栏、内容区）都会聚焦窗口
- **拖拽/调整聚焦**：开始拖拽或调整大小时自动聚焦窗口
- **z-index 管理**：被聚焦的窗口 z-index 最高，渲染在最上方
- **视觉反馈**：聚焦的窗口有更明显的阴影效果

### 5. 边界约束

- **位置约束**：窗口边框不能超出 workspace 边缘
- **自动调整**：拖拽或调整大小时自动应用边界约束
