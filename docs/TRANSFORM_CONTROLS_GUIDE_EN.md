# Transform Controls Gizmo Implementation Guide

## 1: Clicking Gizmo Axis Selects the Axis Itself

### Problem Description

When users click on the gizmo's axes (AXIS X/Y/Z), these axes get selected instead of the object they want to manipulate.

### Background: How Raycaster Works

Three.js Raycaster projects a ray from screen position to detect which 3D objects it intersects:
- `raycaster.setFromCamera(vector2, camera)` - Projects a ray from mouse position
- `raycaster.intersectObjects(scene.children, true)` - Detects all child objects
- Returns all intersections sorted by distance

When using `raycaster.intersectObjects(scene.children, true)`, it detects ALL objects in the scene, **including TransformControls' helper objects**.

### Solution

We need to distinguish between "selectable objects" and "UI helper objects". Three.js provides two mechanisms:

1. **Layers System** - Controls render visibility (e.g., ground layer, player layer)
2. **userData** - Stores custom metadata

**Design Decision**: Layers for render control, userData for selection filtering. This approach:
- Allows different render layers (ground, player) to all be selectable
- Keeps UI helpers never selectable
- Maintains system clarity and extensibility

Define standards in the core library, mark gizmo as UI helper when creating it, and filter during selection.

---

## 2: Keyboard Events Cannot Be Captured

### Problem Description

Mouse events work fine, but keyboard events (W/E/R to switch gizmo mode, Ctrl+Z to undo, etc.) cannot be captured.

### Background: Mouse Events vs Keyboard Events

This is about the fundamental difference in browser event dispatch mechanisms:

**Mouse events** are spatial-based:
- Browser knows where the mouse pointer is on the screen
- Events are sent to elements under the mouse pointer
- Elements don't need focus
- Canvas, div, and any elements can receive mouse events

**Keyboard events** are focus-based:
- Browser doesn't know where the keyboard "is"
- Events are only sent to elements that currently have focus
- Only interactive elements (input, button, elements with tabindex) can receive keyboard events
- Canvas is not in the focus chain by default and cannot receive keyboard events

### Solution

Make Canvas focusable and automatically gain focus: Set `tabindex="0"` to put canvas in the focus chain, and automatically focus on mouse interaction.

Now canvas can receive both mouse and keyboard events, and shortcuts will work properly.

