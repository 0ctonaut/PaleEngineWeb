# UI Components Guide

This document introduces common UI component types in web applications and 3D editors, as well as components implemented and planned in the PaleEngine editor.

---

## 1. General Web UI Components

### 1. Container Components

#### Modal
- **Purpose**: Overlay dialogs that block background interaction and require user action to close
- **Use Cases**: Confirmation dialogs, settings panels, form submissions
- **Features**: Background overlay, focus lock, ESC to close

#### Drawer/Sidebar
- **Purpose**: Panels that slide out from screen edges
- **Use Cases**: Navigation menus, settings panels, detail displays
- **Features**: Slide-in animation, collapsible/expandable

#### Popover
- **Purpose**: Small floating content boxes, usually with arrows pointing to trigger elements
- **Use Cases**: Tooltips, dropdown menus, quick settings
- **Features**: Smart positioning, arrow pointing, click outside to close

#### Tooltip
- **Purpose**: Small hints displayed on mouse hover
- **Use Cases**: Explaining functionality, showing shortcuts, additional information
- **Features**: Hover trigger, delayed display, brief text

---

### 2. Navigation Components

#### Navbar/Toolbar
- **Purpose**: Navigation area at the top of pages
- **Use Cases**: Main function buttons, menus, logo display
- **Features**: Fixed positioning, responsive layout

#### Tabs
- **Purpose**: Tab switching for content grouping
- **Use Cases**: Settings page grouping, browser tabs, multi-view switching
- **Features**: Active state indication, keyboard navigation

#### Breadcrumb
- **Purpose**: Shows current page position in website structure
- **Use Cases**: Multi-level navigation, path display
- **Features**: Clickable navigation, hierarchical separators

#### Pagination
- **Purpose**: Paginated content browsing
- **Use Cases**: Search results, list data, article lists
- **Features**: Page number navigation, previous/next buttons

---

### 3. Form Components

#### Form
- **Purpose**: Container with multiple input controls
- **Use Cases**: Data collection, user registration, settings configuration
- **Features**: Validation, submission handling, error messages

#### Input
- **Purpose**: Text input controls
- **Types**: Text box, password box, search box, number input
- **Features**: Placeholders, validation, prefix/suffix icons

#### Select/Dropdown
- **Purpose**: Selection from predefined options
- **Use Cases**: Country selection, category selection, sorting methods
- **Features**: Search functionality, multi-select, grouped options

#### Checkbox
- **Purpose**: Multi-select controls
- **Use Cases**: Terms agreement, feature toggles, multiple selections
- **Features**: Three-state support (checked/unchecked/partially checked)

#### Radio
- **Purpose**: Single-select controls
- **Use Cases**: Gender selection, payment methods, unique options
- **Features**: Mutually exclusive selection, grouping

#### Slider/Range
- **Purpose**: Numeric range selection
- **Use Cases**: Price ranges, volume control, parameter adjustment
- **Features**: Drag interaction, dual sliders, scale markers

#### DatePicker
- **Purpose**: Date and time selection
- **Use Cases**: Birthday selection, appointment scheduling, calendar events
- **Features**: Calendar view, quick selection, range selection

---

### 4. Data Display Components

#### Table
- **Purpose**: Row and column data display
- **Use Cases**: User lists, data reports, statistics
- **Features**: Sorting, filtering, pagination, fixed headers

#### List
- **Purpose**: Vertically arranged data items
- **Use Cases**: Message lists, file lists, task lists
- **Features**: Virtual scrolling, infinite loading, drag sorting

#### Card
- **Purpose**: Information block containers
- **Use Cases**: Product displays, article summaries, user information
- **Features**: Image headers, content areas, action buttons

#### Grid
- **Purpose**: Grid layout display
- **Use Cases**: Image galleries, product lists, dashboards
- **Features**: Responsive layout, adaptive columns

#### Chart
- **Purpose**: Data visualization
- **Types**: Bar charts, pie charts, line charts, scatter plots
- **Features**: Interactive, animation effects, data updates

---

### 5. Feedback Components

#### Alert
- **Purpose**: Important information prompts
- **Types**: Success, warning, error, info
- **Features**: Eye-catching colors, icons, dismissible

#### Toast/Notification
- **Purpose**: Temporary message prompts
- **Use Cases**: Operation success prompts, system notifications
- **Features**: Auto-dismiss, stacked display, configurable position

#### Loading
- **Purpose**: Loading state indication
- **Types**: Spinning icons, skeleton screens, progress bars
- **Features**: Overlay, delayed display

#### Progress
- **Purpose**: Progress indication
- **Use Cases**: Upload progress, installation progress, task completion
- **Features**: Percentage display, color changes, animation effects

---

### 6. Interactive Components

#### Button
- **Purpose**: Controls that trigger actions
- **Types**: Primary, secondary, text, icon buttons
- **Features**: Disabled state, loading state, click feedback

#### Switch/Toggle
- **Purpose**: On/off state switching
- **Use Cases**: Feature toggles, setting options
- **Features**: Sliding animation, immediate effect

#### Accordion
- **Purpose**: Collapsible content areas
- **Use Cases**: FAQ lists, settings grouping, content organization
- **Features**: Expand animation, single/multiple expand

#### Carousel/Slider
- **Purpose**: Image or content carousel
- **Use Cases**: Product displays, ad carousels, image browsing
- **Features**: Auto-play, indicators, left/right navigation

---

### 7. Layout Components

#### Container
- **Purpose**: Content wrapper providing unified margins
- **Use Cases**: Page containers, content areas
- **Features**: Max-width limits, center alignment

#### Grid System
- **Purpose**: Responsive layout grid
- **Use Cases**: Page layout, responsive design
- **Features**: 12-column system, breakpoint responsiveness

#### Flex
- **Purpose**: Flexbox layout
- **Use Cases**: Horizontal/vertical arrangement, space distribution
- **Features**: Auto-stretch, alignment methods

#### Stack
- **Purpose**: Vertical or horizontal stacking
- **Use Cases**: Button groups, tag groups, simple lists
- **Features**: Spacing control, direction switching

---

### 8. Special Purpose Components

#### ColorPicker
- **Purpose**: Color selection tool
- **Use Cases**: Theme settings, drawing tools, material editing
- **Features**: Color palette, RGB/HSL input, eyedropper tool

#### FileUpload
- **Purpose**: File selection and upload
- **Use Cases**: Avatar upload, document upload, resource import
- **Features**: Drag upload, progress display, preview functionality

#### RichTextEditor
- **Purpose**: Formatted text editing
- **Use Cases**: Blog editors, email editors, document editing
- **Features**: Toolbar, shortcuts, Markdown support

---

## 2. 3D Software-Specific UI Components

### 1. Transform Gizmo
- **Purpose**: Visual transformation controller in 3D space
- **Functions**:
  - Move (Translate): XYZ axis arrows
  - Rotate: XYZ axis rings
  - Scale: XYZ axis cubes
- **Features**:
  - World/Local coordinate system switching
  - Axis constraints (single axis, plane)
  - Snap functionality (grid snap, angle snap)
  - Keyboard shortcuts (W/E/R mode switching)
- **Reference Software**: Blender, Unity, Unreal Engine

### 2. Viewport Controls

#### ViewCube
- **Purpose**: Quick standard view switching
- **Function**: Click cube faces to switch to corresponding views (front/back/left/right/top/bottom)
- **Features**: Rotation animation, orthographic/perspective switching

#### Grid Settings
- **Purpose**: Control scene grid display
- **Function**: Grid spacing, major/minor grids, show/hide
- **Features**: Dynamic scaling, color configuration

#### Snap Controls
- **Purpose**: Precise positioning assistance
- **Types**:
  - Vertex Snap
  - Grid Snap
  - Angle Snap
  - Surface Snap
- **Features**: Keyboard toggle, snap distance configuration

#### Shading Mode Selector
- **Purpose**: Switch viewport display modes
- **Modes**:
  - Wireframe
  - Solid
  - Material Preview
  - Rendered
- **Features**: Quick switching, custom colors

### 3. Hierarchy/Outliner
- **Purpose**: Display tree hierarchy of scene objects
- **Functions**:
  - Parent-child relationship management
  - Multi-select, box select
  - Search and filtering
  - Show/hide control (eye icon)
  - Lock/unlock (lock icon)
  - Drag reorganization
- **Features**:
  - Icon identification of object types
  - Expand/collapse animation
  - Right-click context menu
- **Reference Software**: Unity Hierarchy, Unreal Engine Outliner, Blender Outliner

### 4. Properties Panel
- **Purpose**: Display and edit selected object properties
- **Common Groups**:
  - Transform: Position, Rotation, Scale
  - Material: Color, textures, shaders
  - Physics: Rigid body, colliders
  - Components: Scripts, effectors

#### Vector3 Input
- **Purpose**: Edit 3D vector values (position, rotation, scale)
- **Features**:
  - Separate XYZ axis input
  - Color coding (X=red, Y=green, Z=blue)
  - Drag to adjust values
  - Proportional lock (for scaling)
  - Reset button

#### Collapsible Sections
- **Purpose**: Group management of numerous properties
- **Features**: Expand/collapse animation, state memory

### 5. Timeline
- **Purpose**: Animation editing and preview
- **Functions**:
  - Keyframe marking and editing
  - Playback controls (play/pause/stop)
  - Time scale ruler
  - Frame rate settings
  - Curve editing
- **Features**:
  - Scalable timeline
  - Drag keyframes
  - Multi-track support
- **Reference Software**: Unity Timeline, Blender Dope Sheet

### 6. Asset Browser
- **Purpose**: Manage and preview project assets
- **Asset Types**: Models, textures, materials, audio, scripts
- **Functions**:
  - Grid/list view switching
  - Thumbnail preview
  - Drag to scene
  - Search and filtering
  - Folder organization
- **Features**:
  - Real-time preview
  - Favorites functionality
  - Import/export
- **Reference Software**: Unity Project, Unreal Engine Content Browser

### 7. Scene View
- **Purpose**: Main 3D editing viewport
- **Functions**:
  - Camera control (rotate, pan, zoom)
  - Object selection and manipulation
  - Gizmo display
  - Helper line display
- **Features**:
  - Multi-viewport layout (four views)
  - Full-screen toggle
  - Camera bookmarks

### 8. Inspector
- **Purpose**: Display detailed information of selected objects
- **Content**:
  - Object name and tags
  - Statistics (vertex count, face count, triangle count)
  - Material ball preview
  - UV display
- **Features**: Real-time updates, multi-object editing

### 9. Console
- **Purpose**: Display logs, warnings, and error messages
- **Functions**:
  - Message filtering (Info/Warning/Error)
  - Clear logs
  - Message search
  - Stack trace
- **Features**: Color coding, click to locate code

### 10. Minimap/Navigator
- **Purpose**: Scene overview and quick navigation
- **Functions**:
  - Scene thumbnail
  - Current viewport position indicator
  - Click to jump quickly
- **Features**: Auto-update, draggable

### 11. Node Editor
- **Purpose**: Visual programming and material editing
- **Applications**:
  - Material nodes (Shader Graph)
  - Particle systems
  - Animation logic
  - Blueprints
- **Functions**:
  - Node creation and deletion
  - Connection management
  - Node search
  - Box selection and batch operations
- **Features**:
  - Real-time preview
  - Node grouping
  - Comment functionality
- **Reference Software**: Blender Shader Editor, Unreal Engine Material Editor

### 12. Performance Profiler
- **Purpose**: Performance monitoring and optimization
- **Display Content**:
  - FPS (frame rate)
  - Draw Calls
  - Vertices/Triangles count
  - Memory Usage
  - GPU/CPU time
- **Features**: Real-time charts, peak markers

---