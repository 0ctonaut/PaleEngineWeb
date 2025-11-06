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
    Quaternion,
    Sprite,
    SpriteMaterial,
    CanvasTexture,
    Color
} from 'three/webgpu';

export interface AxisColorConfig {
    color: number;
    negativeSphere?: number;
}

export interface ViewHelperGizmoConfig {
    size?: number;
    axisColors?: {
        x?: AxisColorConfig;
        y?: AxisColorConfig;
        z?: AxisColorConfig;
    };
}

export enum ViewDirection {
    POSITIVE_X = '+x',
    NEGATIVE_X = '-x',
    POSITIVE_Y = '+y',
    NEGATIVE_Y = '-y',
    POSITIVE_Z = '+z',
    NEGATIVE_Z = '-z'
}

interface LabelInfo {
    sprite: Sprite;
    sphere: Mesh;
    isPositive: boolean;
    blackTexture?: CanvasTexture;
    whiteTexture: CanvasTexture;
}

interface CircleOutlineInfo {
    outlineSphere: Mesh;
    targetSphere: Mesh;
    axisColor: number;
}

export class ViewHelperGizmo {
    private scene!: Scene;
    private camera!: OrthographicCamera;
    private gizmoGroup!: Group;
    private sphereGroup!: Group;
    private spheres: Map<Mesh, ViewDirection> = new Map();
    private labels: LabelInfo[] = [];
    private circleOutlines: CircleOutlineInfo[] = [];
    private raycaster: Raycaster;
    private axisLength: number;
    private sphereRadius: number = 0.15;
    private labelOffset: number = 0.05;
    private axisColors?: ViewHelperGizmoConfig['axisColors'];
    private hoveredSphere: Mesh | null = null;
    
    constructor(config: ViewHelperGizmoConfig = {}) {
        this.axisLength = config.size || 1.0;
        this.axisColors = config.axisColors;
        this.raycaster = new Raycaster();
        this.scene = new Scene();
        const backgroundColor = 'dimgray';
        this.scene.background = new Color(backgroundColor);
        // temp
        this.scene.background = null;
        this.createCamera();
        this.createGizmo();
    }
    
    private createCamera(): void {
        this.camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 120);
        this.camera.position.set(0, 0, 100);
        this.camera.lookAt(0, 0, 0);
    }
    
    private createGizmo(): void {
        this.gizmoGroup = new Group();
        this.sphereGroup = new Group();
        
        const defaultColors = {
            x: { color: 0xff0000 },
            y: { color: 0x00ff00 },
            z: { color: 0x0000ff }
        };
        
        const xColor = this.axisColors?.x ?? defaultColors.x;
        const yColor = this.axisColors?.y ?? defaultColors.y;
        const zColor = this.axisColors?.z ?? defaultColors.z;
        
        this.createAxis('x', xColor, new Vector3(1, 0, 0));
        this.createAxis('y', yColor, new Vector3(0, 1, 0));
        this.createAxis('z', zColor, new Vector3(0, 0, 1));
        
        this.gizmoGroup.add(this.sphereGroup);
        this.scene.add(this.gizmoGroup);
    }
    
    private createAxis(axisName: string, colorConfig: AxisColorConfig, direction: Vector3): void {
        const arrowLength = this.axisLength;
        const axisColor = colorConfig.color;
        const positiveSphereColor = axisColor;
        const negativeSphereColor = colorConfig.negativeSphere ?? (axisColor * 0.8);
        
        const arrowHelper = new ArrowHelper(
            direction,
            new Vector3(0, 0, 0),
            arrowLength,
            axisColor,
            0.05, // head length
            0.05  // head width
        );
        
        this.gizmoGroup.add(arrowHelper);
        
        const sphereGeometry = new SphereGeometry(this.sphereRadius, 16, 16);
        const scalar = 0.8;
        
        const positiveSphere = new Mesh(sphereGeometry, new MeshBasicMaterial({ 
            color: positiveSphereColor
        }));
        positiveSphere.position.copy(direction.clone().multiplyScalar(arrowLength));
        positiveSphere.scale.set(scalar, scalar, scalar);

        const negativeSphere = new Mesh(sphereGeometry, new MeshBasicMaterial({ 
            color: negativeSphereColor
        }));
        negativeSphere.position.copy(direction.clone().multiplyScalar(-arrowLength));
        negativeSphere.scale.set(scalar, scalar, scalar);
        
        const outlineSphereGeometry = new SphereGeometry(this.sphereRadius, 16, 16);
        
        const positiveOutlineSphere = new Mesh(outlineSphereGeometry, new MeshBasicMaterial({ 
            color: axisColor
        }));
        positiveOutlineSphere.raycast = () => {};
        
        const negativeOutlineSphere = new Mesh(outlineSphereGeometry, new MeshBasicMaterial({ 
            color: axisColor
        }));
        negativeOutlineSphere.raycast = () => {};
        
        this.spheres.set(positiveSphere, this.getPositiveDirection(axisName));
        this.spheres.set(negativeSphere, this.getNegativeDirection(axisName));
        
        this.addLabel(positiveSphere, axisName, true);
        this.addLabel(negativeSphere, axisName, false);
        
        this.circleOutlines.push({ outlineSphere: positiveOutlineSphere, targetSphere: positiveSphere, axisColor });
        this.circleOutlines.push({ outlineSphere: negativeOutlineSphere, targetSphere: negativeSphere, axisColor });
        
        this.sphereGroup.add(positiveSphere);
        this.sphereGroup.add(negativeSphere);
        this.scene.add(positiveOutlineSphere);
        this.scene.add(negativeOutlineSphere);
    }
    
    private addLabel(sphere: Mesh, axisName: string, isPositive: boolean): void {
        const text = (isPositive ? '+' : '-') + axisName.toUpperCase();
        
        let blackTexture: CanvasTexture | undefined;
        
        if (isPositive) {
            const blackCanvas = document.createElement('canvas');
            const blackContext = blackCanvas.getContext('2d')!;
            blackCanvas.width = 256;
            blackCanvas.height = 256;
            blackContext.font = 'bold 150px Consolas';
            blackContext.fillStyle = '#010101';
            blackContext.textAlign = 'center';
            blackContext.textBaseline = 'middle';
            blackContext.fillText(text, blackCanvas.width / 2, blackCanvas.height / 2);
            blackTexture = new CanvasTexture(blackCanvas);
        }
        
        const whiteCanvas = document.createElement('canvas');
        const whiteContext = whiteCanvas.getContext('2d')!;
        whiteCanvas.width = 256;
        whiteCanvas.height = 256;
        whiteContext.font = 'bold 150px Consolas';
        whiteContext.fillStyle = '#ffffff';
        whiteContext.textAlign = 'center';
        whiteContext.textBaseline = 'middle';
        whiteContext.fillText(text, whiteCanvas.width / 2, whiteCanvas.height / 2);
        const whiteTexture = new CanvasTexture(whiteCanvas);
        
        const material = new SpriteMaterial({
            map: isPositive ? blackTexture! : whiteTexture,
            transparent: true,
            alphaTest: 0.1,
            opacity: isPositive ? 1 : 0
        });
        
        const sprite = new Sprite(material);
        sprite.scale.set(0.3, 0.3, 1);
        sprite.raycast = () => {};
        
        this.labels.push({ 
            sprite, 
            sphere, 
            isPositive,
            blackTexture,
            whiteTexture
        });
        
        this.scene.add(sprite);
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
    
    public syncWithCamera(quaternion: Quaternion): void {
        this.gizmoGroup.quaternion.copy(quaternion).invert();
    }
    
    public async render(renderer: any): Promise<void> {
        this.labels.forEach(({ sprite, sphere, isPositive, blackTexture, whiteTexture }) => {
            const sphereWorldPos = sphere.getWorldPosition(new Vector3());
            const direction = sphereWorldPos.clone().sub(this.camera.position).normalize();
            const offset = this.sphereRadius + this.labelOffset;
            sprite.position.copy(sphereWorldPos).add(direction.multiplyScalar(-offset));
            sprite.lookAt(this.camera.position);
            
            const material = sprite.material as SpriteMaterial;
            const isHovered = this.hoveredSphere === sphere;
            
            if (isPositive) {
                material.map = isHovered ? whiteTexture : (blackTexture!);
                material.opacity = 1;
            } else {
                material.map = whiteTexture;
                material.opacity = isHovered ? 1 : 0;
            }
        });
        
        this.circleOutlines.forEach(({ outlineSphere, targetSphere, axisColor }) => {
            const sphereWorldPos = targetSphere.getWorldPosition(new Vector3());
            const direction = sphereWorldPos.clone().sub(this.camera.position).normalize();
            const offset = this.sphereRadius * 0.5;
            outlineSphere.position.copy(sphereWorldPos).add(direction.multiplyScalar(offset));
            
            const material = outlineSphere.material as MeshBasicMaterial;
            const isHovered = this.hoveredSphere === targetSphere;
            material.color.setHex(isHovered ? 0xf7f7f7 : axisColor);
        });
        
        await renderer.render(this.scene, this.camera);
    }
    
    private getSphereAtPosition(mouseX: number, mouseY: number, viewportSize: number): Mesh | null {
        this.gizmoGroup.updateMatrixWorld(true);
        
        const x = (mouseX / viewportSize) * 2 - 1;
        const y = -(mouseY / viewportSize) * 2 + 1;
        
        this.raycaster.setFromCamera(new Vector2(x, y), this.camera);
        const intersects = this.raycaster.intersectObjects([this.gizmoGroup], true);
        
        if (intersects.length > 0) {
            for (const intersect of intersects) {
                const hitObject = intersect.object as Mesh;
                if (this.spheres.has(hitObject)) {
                    return hitObject;
                }
            }
        }
        
        return null;
    }
    
    public handleHover(mouseX: number, mouseY: number, viewportSize: number): void {
        if (mouseX < 0 || mouseY < 0) {
            this.hoveredSphere = null;
            return;
        }
        this.hoveredSphere = this.getSphereAtPosition(mouseX, mouseY, viewportSize);
    }
    
    public handleClick(mouseX: number, mouseY: number, viewportSize: number): ViewDirection | null {
        const hitSphere = this.getSphereAtPosition(mouseX, mouseY, viewportSize);
        if (hitSphere) {
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
        
        this.labels.forEach(({ sprite, blackTexture, whiteTexture }) => {
            if (sprite.material) {
                const material = sprite.material as SpriteMaterial;
                material.dispose();
            }
            if (blackTexture) {
                blackTexture.dispose();
            }
            if (whiteTexture) {
                whiteTexture.dispose();
            }
        });
        
        this.circleOutlines.forEach(({ outlineSphere }) => {
            if (outlineSphere.geometry) {
                outlineSphere.geometry.dispose();
            }
            if (outlineSphere.material) {
                (outlineSphere.material as MeshBasicMaterial).dispose();
            }
        });
        
        this.scene.clear();
    }
}
