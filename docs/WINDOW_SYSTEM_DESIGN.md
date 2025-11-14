# 概述

新版窗口系统方案

# 类设计

```javascript
abstract class BaseWindow {
    uuid;
}

class WindowDragHandler;
class WindowResizer;
class WindowContentMenu;
```

```javascript
class SimpleWindow extends BaseWindow{
    private string _name;
    titlebar;
    htmlContent;
}
```

```javascript
class TabContainer extends BaseWindow {
    
}
```

```javascript
type SplitDirection = 'horizontal' | 'vertical';

class SplitContainer extends BaseWindow {
    
}
```

一个BaseWindow就是一个Window树，每一个树节点可能是SimpleWindow、TabContainer、SplitContainer：
+ `SimpleWindow`只能作为叶子节点, 有实际内容
    - 只有`SimpleWindow`拥有name。
    - `SimpleWindow`的titlebar并不是全占满。而是以“tab”的样式显示一个html元素

+ `TabContainer`是容器，没有实际内容，只能容纳`SimpleWindow`; 
    - `TabContainer`的titleBar以tab的方式显示其中容纳的SimpleWindow的name，可以容纳多个tab，点击tab可以切换到不同的SimpleWindow
    - Tab之间通过拖拽改变排列方式，需要丝滑的挤压动画

+ `SplitContainer`是容器，没有实际内容，可以容纳`SplitContainer`、`SimpleWindow`和`TabContainer`，允许上下 divide 和左右 divide；

## 基础操作

+ 所有BaseWindow分为浮动和吸附状态
+ 浮动的时候可以随意resize、移动，当然resize有最小限制，最大也会被限制在workspace内部
+ 吸附的时候会有三边和其他Window或者workspace边缘接触，这时只有一边是可以活动resize的
+ 可以通过拖拽将吸附态转为浮动态


## 拖拽操作

+ 只有Tab这个html元素允许被拖拽，且同时只能拖拽单个

### 窗口 merge / stack / divide

命名约定：

- `merge`：指浮动窗口重新回到布局树的过程，可能最终形成 `stack` 或 `divide`。
- `stack`：指合并进目标 `TabContainer`。
- `divide`：指创建或扩展 `SplitContainer`。
- `detach`：指从容器中剥离，重新变成浮动窗口。

具体交互：

- 两个 `TabContainer`：拖拽其中一个的 tab 到另一个 `TabContainer` 的 titlebar 上，展示 `stack` 预览，释放后将源容器中的 `SimpleWindow` stack 到目标 `TabContainer`，源 `TabContainer` 销毁。
- 两个 `SimpleWindow`：拖拽其中一个的 header 到另一个 header 附近，展示 `stack` 预览，释放后创建新的 `TabContainer`，两个窗口以 tab 形式 stack。
- `SimpleWindow` → `TabContainer`：拖拽 `SimpleWindow` 的 header 到目标 titlebar，展示 `stack` 预览，释放后直接 stack。
- `TabContainer` → `SimpleWindow`：不触发 stack。

- `TabContainer` 之间进行 divide：拖拽 tab 到目标内容区域的上下左右（`calculateNearestSide()`），展示 `divide` 预览，释放后创建新的 `SplitContainer`，原来的两个子树作为 `SplitContainer` 的子节点。继续拖拽时可递归 divide。
- 两个 `SimpleWindow` 触发 divide：先将双方分别 stack 进新的 `TabContainer`，再执行 divide 逻辑。
- `TabContainer` 与 `SimpleWindow` divide：为 `SimpleWindow` 创建临时 `TabContainer` 后执行 divide。

- `SimpleWindow` 可以从 `TabContainer` 或 `SplitContainer` detach，detach 后转为浮动状态。

### workspace填充
workspace是一块固定大小的区域，只要我们不resize浏览器。把所有tab都脱离才允许workspace空白，否则按照 divide 规则填满workspace。

### 吸附到workspace边缘
有了workspace填充和 divide，不再需要吸附到边缘了


## 当前实现说明

### 基础结构

- Workspace 始终维护一棵窗口树（`WindowTreeStore`），根节点固定在 `TabContainer` 内，所有 `SimpleWindow` 都以 Tab 形式展示。
- `WindowDomRenderer` 将窗口树渲染到 `.pale-window-root-layer`，同时维护 `.pale-window-floating-layer` 用于显示浮动窗口。
- 每个浮动窗口都会携带完整的子树（通常是一个 TabContainer），结构与固定窗口保持一致。

### 交互体系

- 统一依赖 `InputContext` / `LocalInputManager` / `GlobalInputManager`。
- Tab 点击或拖拽、Split 分割条、浮动窗口的拖拽与缩放都通过 `WindowInteractionManager` 管理。
- 聚焦逻辑：点击 / 拖拽 / 缩放任意浮动窗口都会调用 `WindowTreeStore.bringFloatingToFront`，刷新 z-index 并重绘，使其显示在最上层。

### 浮动逻辑

- 拖拽 Tab 离开 TabBar、或 SimpleWindow Header 离开 Workspace 时会触发 `floatSimpleWindow`：
  - 简单窗口从树中拆离，并包装进独立 `TabContainer`，确保 Tab 风格标题不变。
  - 生成 `FloatingWindowDescriptor`，持久化位置、尺寸、z-index 等信息。
  - 浮动窗口渲染后附带 8 向 resize hande，支持绝对定位拖拽与缩放，自动限制在 Workspace 内。
- 浮动窗口拖拽过程中重新查询当前 DOM 节点，使得 z-index 更新触发的重绘不会中断操作。
- Tab 拖拽与浮动 TabBar 拖拽都会在 `bringFloatingToFront` 后重新获取 `.pale-window-floating` 节点，确保拖拽过程中总是绑定最新 DOM，避免因重新渲染造成的滞后。

### 浮动 / Docking 分层与数据流

- 渲染层分为两部分：
  - `.pale-window-root-layer`：用于渲染当前窗口树的根节点（`TabContainer`/`SplitContainer`），所有吸附窗口都会挂在这里。
  - `.pale-window-floating-layer`：用于渲染 `floatingRootsMap` 中登记的浮动子树，窗口以 `.pale-window-floating` 包裹并承载 resize handle。
- `WindowTreeStore` 维护一份 `floatingRootsMap`（key 为浮动子树的根节点 id），以及 `floatingNodeIndex`（SimpleWindow → 根 id）组成的 “floating forest”。每条 `FloatingWindowDescriptor` 记录根 id、当前激活的 `activeNodeId`、位置、尺寸、z-index 等信息。
- 浮动 tab 再次 detach 时，会为该 tab 包装新的独立 `TabContainer` 并生成新的根记录，同时刷新旧根的索引，保证剩余 tab 仍然通过原 root 渲染。
- `WindowDomRenderer.renderFloatingWindows()` 遍历 `floatingRootsMap`，按根节点渲染完整子树并设置 transform / size / z-index，使浮动层与吸附层保持解耦。
- 浮动状态下，拖拽 `TabContainer` 的 tabbar 空白区域（非具体 tab 按钮）可以移动整个容器，方便在多 tab 布局中快速 reposition。
- 当浮动 `SplitContainer` 中拆出子节点导致只剩单子时，会将剩余子树通过 `reassignFloatingRoot` 升为新浮动根，避免误写 `rootId` 影响 docking 层。

### 交互分工与核心流程

- `WindowInteractionManager` 在鼠标按下时建立拖拽 session，并将事件分派到三套交互器：
  - `WindowInteractionDocking`：负责吸附态容器间的 stack/divide、tab 重排等操作。
  - `FloatingInteraction`：负责浮动窗口移动、缩放、tab 重排以及从浮动拖回布局树时的 docking 预览。
  - `WindowInteractionShared`：抽象了输入事件的共用接口与合成事件。
- 浮动窗口拖动流程：
  1. `FloatingInteraction.beginFloatingWindowDrag` 记录初始位置，进入 `DragSession`。
  2. `handleFloatingMove` 更新临时 descriptor 并驱动 docking 预览（`updateFloatingDockingPreview`）。
  3. 鼠标释放时调用 `stopFloatingDrag`，若未 dock 则通过 `store.setFloatingWindow` 落地最新位置；若 dock 成功则交给 `WindowInteractionDocking` 完成树结构调整。
- 浮动 tab detach 流程：
  1. `handleFloatingTabMove` 判断指针是否离开 tabbar；一旦离开即 `detachFloatingTab`。
  2. `WindowTreeStore.detachSimpleWindow` 将当前 tab 从容器中拆出、包装为独立 `TabContainer`，写入新的浮动根节点，并刷新旧根在 `floatingNodeIndex` 中的成员。
  3. 通过 `host.beginFloatingDragFromTab` 在同一拖拽手势内切换为浮动窗口拖拽，旧浮动容器在 forest 中仍拥有独立根节点，剩余 tab 不会被销毁。
- Docking/Stack 流程：
  1. `WindowInteractionDocking` 根据指针位置计算 `DockingScope`，显示 `DockingPreview` 或 divide overlay。
  2. 释放鼠标时调用 `store.moveSimpleToTab` 或 `store.divideSimpleWithExisting` 等 API，直接修改窗口树结构。
  3. 结构变更通过 `tree-changed` 事件触发重新渲染，同时会根据需要调用 `reassignFloatingRoot` 确保浮动窗口的子树引用保持一致。

### 样式要点

- `.pale-window-simple`、`.pale-window-floating__content`、`.pale-window-tabContainer` 等节点均设置 `width: 100%` 与合适的 `flex`，保证 resize 后内容与边框始终贴合。
- `.pale-window-tab` 采用紧凑的左对齐样式，无论固定或浮动均保持一致的 Tab 外观。

### 已知问题 / 待优化

- 浮动窗口仍缺少吸附、最大化、关闭等高级交互。
- Workspace 内部尚未对浮动窗口与嵌入式布局之间的拖拽合并（Dock）做完整处理。