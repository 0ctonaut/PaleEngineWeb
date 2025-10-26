import { 
    Scene, 
    Mesh, 
    MeshBasicMaterial, 
    SphereGeometry,
    OrthographicCamera,
    Group,
    Vector3,
    Raycaster,
    Vector2,
    ArrowHelper,
    Quaternion
} from 'three/webgpu';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

export interface ViewHelperGizmoConfig {
    /** Axis length (default: 1.0) */
    size?: number;
}

export enum ViewDirection {
    POSITIVE_X = '+x',
    NEGATIVE_X = '-x',
    POSITIVE_Y = '+y',
    NEGATIVE_Y = '-y',
    POSITIVE_Z = '+z',
    NEGATIVE_Z = '-z'
}

export class ViewHelperGizmo {
    private scene!: Scene;
    private camera!: OrthographicCamera;
    private gizmoGroup!: Group;
    private sphereGroup!: Group;
    private spheres: Map<Mesh, ViewDirection> = new Map();
    private raycaster: Raycaster;
    private axisLength: number;
    private labelRenderer!: CSS2DRenderer;
    private labelContainer!: HTMLElement;
    
    constructor(config: ViewHelperGizmoConfig = {}) {
        this.axisLength = config.size || 1.0;
        this.raycaster = new Raycaster();
        
        this.scene = new Scene();
        this.createCamera();
        this.createLabelRenderer();
        this.createGizmo();
    }
    
    private createLabelRenderer(): void {
        // Create label container
        this.labelContainer = document.createElement('div');
        this.labelContainer.style.position = 'absolute';
        this.labelContainer.style.width = '128px';
        this.labelContainer.style.height = '128px';
        this.labelContainer.style.overflow = 'hidden';
        this.labelContainer.style.pointerEvents = 'none';
        this.labelContainer.style.zIndex = '1000';
        
        // Create CSS2DRenderer for text labels
        this.labelRenderer = new CSS2DRenderer({ element: this.labelContainer });
        this.labelRenderer.setSize(128, 128);
        
        // Container will be added to DOM by World class
    }
    
    private createCamera(): void {
        this.camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        this.camera.position.set(0, 0, 5);
        this.camera.lookAt(0, 0, 0);
    }
    
    private createGizmo(): void {
        this.gizmoGroup = new Group();
        this.sphereGroup = new Group();
        
        // Create 3 axis lines with spheres
        this.createAxis('x', 0xff0000, new Vector3(1, 0, 0)); // Red for X
        this.createAxis('y', 0x00ff00, new Vector3(0, 1, 0)); // Green for Y
        this.createAxis('z', 0x0000ff, new Vector3(0, 0, 1)); // Blue for Z
        
        this.gizmoGroup.add(this.sphereGroup);
        this.scene.add(this.gizmoGroup);
    }
    
    private createAxis(axisName: string, color: number, direction: Vector3): void {
        const arrowLength = this.axisLength;
        const arrowHelper = new ArrowHelper(
            direction,
            new Vector3(0, 0, 0),
            arrowLength,
            color,
            0.05, // head length
            0.05  // head width
        );
        
        this.gizmoGroup.add(arrowHelper);
        
        // Create spheres at both ends of the axis
        const sphereGeometry = new SphereGeometry(0.15, 16, 16);
        
        // Positive direction sphere (brighter)
        const positiveSphere = new Mesh(sphereGeometry, new MeshBasicMaterial({ color }));
        positiveSphere.position.copy(direction.clone().multiplyScalar(arrowLength));
        
        // Negative direction sphere (darker)
        const negativeSphere = new Mesh(sphereGeometry, new MeshBasicMaterial({ 
            color: color * 0.8
        }));
        negativeSphere.position.copy(direction.clone().multiplyScalar(-arrowLength));
        
        // Store sphere-to-direction mapping
        this.spheres.set(positiveSphere, this.getPositiveDirection(axisName));
        this.spheres.set(negativeSphere, this.getNegativeDirection(axisName));
        
        // Add text labels
        this.addLabel(positiveSphere, axisName, true);
        this.addLabel(negativeSphere, axisName, false);
        
        this.sphereGroup.add(positiveSphere);
        this.sphereGroup.add(negativeSphere);
    }
    
    private addLabel(sphere: Mesh, axisName: string, isPositive: boolean): void {
        // Create simple text label
        const labelDiv = document.createElement('div');
        labelDiv.className = 'gizmo-label';
        labelDiv.textContent = (isPositive ? '+' : '-') + axisName.toUpperCase();
        labelDiv.style.position = 'absolute';
        labelDiv.style.color = '#ffffff';
        labelDiv.style.fontSize = '10px';
        labelDiv.style.fontWeight = 'bold';
        labelDiv.style.textAlign = 'center';
        labelDiv.style.pointerEvents = 'none';
        labelDiv.style.textShadow = '1px 1px 2px rgba(0,0,0,0.9)';
        labelDiv.style.fontFamily = 'Arial, sans-serif';
        
        const label = new CSS2DObject(labelDiv);
        label.position.set(0, 0.0, 0); // Center of sphere
        sphere.add(label);
    }
    
    private getPositiveDirection(axis: string): ViewDirection {
        switch (axis) {
            case 'x': return ViewDirection.POSITIVE_X;
            case 'y': return ViewDirection.POSITIVE_Y;
            case 'z': return ViewDirection.POSITIVE_Z;
            default: return ViewDirection.POSITIVE_X;
        }
    }
    
    private getNegativeDirection(axis: string): ViewDirection {
        switch (axis) {
            case 'x': return ViewDirection.NEGATIVE_X;
            case 'y': return ViewDirection.NEGATIVE_Y;
            case 'z': return ViewDirection.NEGATIVE_Z;
            default: return ViewDirection.NEGATIVE_X;
        }
    }
    
    /**
     * Sync Gizmo rotation with main camera
     */
    public syncWithCamera(quaternion: Quaternion): void {
        this.gizmoGroup.quaternion.copy(quaternion).invert();
    }
    
    /**
     * Set label container position
     */
    public setLabelPosition(gizmoX: number, gizmoY: number): void {
        this.labelContainer.style.top = `${gizmoY}px`;
        this.labelContainer.style.left = `${gizmoX}px`;
    }
    
    /**
     * Get label container for DOM attachment
     */
    public getLabelContainer(): HTMLElement {
        return this.labelContainer;
    }
    
    /**
     * Render Gizmo scene
     */
    public async render(renderer: any): Promise<void> {
        const autoClear = renderer.autoClear;
        renderer.autoClear = false;
        await renderer.render(this.scene, this.camera);
        renderer.autoClear = autoClear;
        
        // Render CSS2D labels
        this.labelRenderer.render(this.scene, this.camera);
    }
    
    /**
     * Handle mouse click, return the direction of the clicked sphere
     */
    public handleClick(mouseX: number, mouseY: number, viewportSize: number): ViewDirection | null {
        // Convert mouse coordinates to Gizmo viewport space (-1 to 1)
        const x = (mouseX / viewportSize) * 2 - 1;
        const y = -(mouseY / viewportSize) * 2 + 1; // Invert Y axis
        
        this.raycaster.setFromCamera(new Vector2(x, y), this.camera);
        
        // Detect all spheres
        const intersects = this.raycaster.intersectObjects(Array.from(this.spheres.keys()));
        
        if (intersects.length > 0) {
            const hitSphere = intersects[0].object as Mesh;
            return this.spheres.get(hitSphere) || null;
        }
        
        return null;
    }
    
    public static getViewParameters(direction: ViewDirection, _distance: number): { azimuth: number; polar: number } {
        switch (direction) {
            case ViewDirection.POSITIVE_X:
                return { azimuth: Math.PI / 2, polar: Math.PI / 2 };
            case ViewDirection.NEGATIVE_X:
                return { azimuth: -Math.PI / 2, polar: Math.PI / 2 };
            case ViewDirection.POSITIVE_Y:
                return { azimuth: 0, polar: 0 };
            case ViewDirection.NEGATIVE_Y:
                return { azimuth: 0, polar: Math.PI };
            case ViewDirection.POSITIVE_Z:
                return { azimuth: 0, polar: Math.PI / 2 };
            case ViewDirection.NEGATIVE_Z:
                return { azimuth: Math.PI, polar: Math.PI / 2 };
            default:
                return { azimuth: 0, polar: Math.PI / 2 };
        }
    }
    
    public dispose(): void {
        this.spheres.forEach((_, sphere) => {
            if (sphere.geometry) {
                sphere.geometry.dispose();
            }
            if (sphere.material) {
                (sphere.material as MeshBasicMaterial).dispose();
            }
        });
        
        this.scene.clear();
    }
}
