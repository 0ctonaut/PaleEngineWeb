# View Helper Gizmo & Gimbal Lock Guide

This document explains the Gimbal Lock problem in detail, including its strict definition, similar issues in spherical coordinate systems, and solutions. It also introduces the ViewHelperGizmo implementation in this project and future version goals.

## Strict Definition of Gimbal Lock

### Definition

**Gimbal Lock** is a problem that occurs when using Euler Angles to represent three-dimensional rotations.

### Core Characteristics

1. **Occurs in Euler angle rotations**: When using three rotation angles (e.g., around X, Y, Z axes) to represent rotations
2. **Axis alignment causes degeneracy**: When an intermediate rotation axis aligns with another axis, one degree of freedom is lost
3. **Rotation order dependent**: The occurrence of the problem depends on the order in which rotations are applied

### Typical Scenario

Using `XYZ` rotation order as an example:

```
Rotate around X axis first → then around Y axis → finally around Z axis
```

When **Y-axis rotation is ±90°**:
- X and Z axes align on the same plane
- Rotations around X and Z axes become equivalent
- **One degree of freedom is lost**, only two directions of rotation can be controlled

### Mathematical Representation

In `XYZ` order, when `Y = ±90°`:
- `X` rotation and `Z` rotation merge into a single degree of freedom
- All three rotation axes cannot be controlled independently

### Visual Example

```
Normal state:        Gimbal lock when Y = 90°:
    Z                    X and Z aligned
    |                    |
    +--X                 +--X/Z (two axes coincide)
   /
  Y                     Y
```

## Degeneracy Problem in Spherical Coordinates

### Definition

**Spherical Coordinate Singularity** is a similar problem that occurs when using spherical coordinates (polar angle and azimuth angle) to represent direction.

### Core Characteristics

1. **Occurs in spherical coordinates**: Using two angle parameters (`polarAngle` and `azimuthAngle`)
2. **Degeneracy at poles**: When polar angle `polarAngle = 0` or `π`, azimuth angle `azimuthAngle` becomes meaningless
3. **Parameter failure**: One control parameter (azimuth angle) completely fails

### Mathematical Representation

Conversion from spherical to Cartesian coordinates:
```
x = distance × sin(polarAngle) × sin(azimuthAngle)
y = distance × cos(polarAngle)
z = distance × sin(polarAngle) × cos(azimuthAngle)
```

When `polarAngle = 0` or `π`:
- `sin(polarAngle) = 0`
- Both X and Z coordinates become 0 (regardless of `azimuthAngle` value)
- **Azimuth angle completely fails**, cannot control horizontal direction

### Visual Example

```
polarAngle = 0 (top):      polarAngle = π (bottom):
    Y+ (camera position)       Y- (camera position)
     |                           |
     • (target)                  • (target)
     
     Changing azimuthAngle      Changing azimuthAngle
     won't change camera pos     won't change camera pos
```

## Problem Comparison

### Similarities

| Feature | Gimbal Lock (Euler Angles) | Spherical Coordinate Degeneracy |
|------|----------------|-----------|
| Loss of degrees of freedom | ✓ | ✓ |
| Special angle failure | ✓ | ✓ |
| Control parameter failure | ✓ | ✓ |
| Actual behavior | Rotation "stuck" or sudden flip | Rotation "stuck" or sudden flip |

### Differences

| Feature | Gimbal Lock (Euler Angles) | Spherical Coordinate Degeneracy |
|------|----------------|-----------|
| Number of parameters | 3 angles | 2 angles |
| Problem location | Intermediate axis ±90° | Polar angle 0 or π |
| Dependent factor | Rotation order | Polar angle value |
| Strict terminology | Gimbal Lock | Singularity/Degeneracy |

### Terminology Notes

- **Gimbal Lock**: Strictly refers to Euler angle problems
- **Spherical Coordinate Degeneracy**: More accurate professional term
- **Practical usage**: When discussing camera control, both are often collectively called "gimbal lock problems"

## Application in the Project

### OrbitCameraController Implementation

The `OrbitCameraController` in this project uses spherical coordinates to control camera rotation.

#### v0.1: Early Polar Angle Restriction Scheme (Current Implementation)

**Core idea**: Avoid reaching true poles (0 or π) by restricting polar angle range.

**Implementation**:
- Use `Spherical` class to manage spherical coordinates
- Use `clamp` to restrict `phi` angle between `EPSILON` and `Math.PI - EPSILON` (`EPSILON = 1e-6`)
- Use `Spherical.setFromVector3()` and `Vector3.setFromSpherical()` for coordinate conversion

**Code example**:
```typescript
const EPSILON = 1e-6;
private spherical: Spherical = new Spherical();

private handleRotate(deltaX: number, deltaY: number): void {
    this.spherical.theta -= deltaX * this.config.rotateSensitivity;
    this.spherical.phi -= deltaY * this.config.rotateSensitivity;
    
    // Restrict polar angle range to avoid poles
    const minPhi = Math.max(EPSILON, this.config.minPolarAngle);
    const maxPhi = Math.min(Math.PI - EPSILON, this.config.maxPolarAngle);
    this.spherical.phi = clamp(this.spherical.phi, minPhi, maxPhi);
    
    this.updateCameraPosition();
}
```

**Characteristics**:
- ✅ Simple implementation, minimal changes
- ✅ Uses standard API, clean code
- ✅ High numerical precision (1e-6), visually almost imperceptible
- ❌ Essentially still early restriction, doesn't fundamentally solve the problem

### ViewHelperGizmo Implementation

The `ViewHelperGizmo` in this project is a 3D viewport helper tool for quickly switching viewpoints and navigating scenes.

#### Core Features

**3D Axis Indicators**:
- Arrow indicators for three axes (X/Y/Z), each with positive and negative directions
- Positive axes: Red (X), green (Y), blue (Z) spheres with black labels
- Negative axes: Same-colored spheres scaled to 0.8, hidden by default, show white labels and outline spheres on hover

**Interaction System**:
- Raycasting for detecting mouse hover and clicks
- Positive axis spheres: Display black labels by default, change to white on hover
- Negative axis spheres: Hidden by default, show white labels and outline spheres on hover
- Click spheres to switch to corresponding view direction

**Billboard Label System**:
- Uses Sprite material to implement labels that always face the camera
- Label positions update dynamically, always on sphere surface and facing camera direction
- Positive axes use both black and white textures (optimized: only create needed textures)
- Negative axes only create white texture

**Camera Synchronization**:
- Gizmo synchronizes with main camera rotation via `syncWithCamera` method
- Uses orthographic camera (OrthographicCamera) for rendering, ensuring gizmo maintains consistent visual size at different viewpoints

**Rendering System**:
- Independent render pass (ViewHelperGizmoPass), separated from main scene
- Updates label positions and outline sphere positions every frame
- Supports custom axis color configuration

#### Implementation Characteristics

- ✅ 3D interaction with intuitive visual feedback
- ✅ Performance optimization: create textures on demand, disable unnecessary raycasting
- ✅ Configurable color system, supports string hex values (convenient for editor integration)
- ✅ Seamless integration with camera system

## Future Version Goals

### v0.2: Seamless Rotation and Animation Transitions

**Goal**: Achieve Blender-like camera control experience

**Seamless 360-degree rotation across poles**:
- Support continuous rotation across poles, avoiding "stuttering" from polar angle restrictions
- Automatically switch azimuth angle when approaching poles to maintain rotation continuity
- Use quaternion interpolation or hybrid coordinate systems for smooth transitions

**View transition animations**:
- Smooth camera transition to target viewpoint when clicking gizmo spheres
- Use easing functions for natural animation effects
- Configurable animation duration and easing curves

**Technical Directions**:
- Quaternion interpolation for smooth rotation
- Hybrid coordinate systems: switch to alternative coordinate system near poles
- Animation system: time-based camera position and rotation interpolation

## References

- [Euler Angles - Wikipedia](https://en.wikipedia.org/wiki/Euler_angles)
- [Gimbal Lock - Wikipedia](https://en.wikipedia.org/wiki/Gimbal_lock)
- [Spherical Coordinate System - Wikipedia](https://en.wikipedia.org/wiki/Spherical_coordinate_system)
- [Quaternion - Wikipedia](https://en.wikipedia.org/wiki/Quaternion)
