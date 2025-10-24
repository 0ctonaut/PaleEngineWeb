import { PerspectiveCamera, Vector3 } from 'three/webgpu';

import { CameraController } from './camera-controller';
import { EventTypes, InputEvent, LocalInputManager } from '../input';

export interface OrbitControllerConfig {
    rotateSensitivity?: number;
    panSensitivity?: number;
    zoomSensitivity?: number;
    minDistance?: number;
    maxDistance?: number;
    minPolarAngle?: number;
    maxPolarAngle?: number;
}

export class OrbitCameraController extends CameraController {
    private inputManager: LocalInputManager;
    private target: Vector3 = new Vector3(0, 0, 0);
    private distance: number = 10;
    private azimuthAngle: number = 0; // Azimuth angle (around Y axis)
    private polarAngle: number = Math.PI / 2; // Polar angle (angle with Y axis)
    
    private config: Required<OrbitControllerConfig>;
    
    // Drag operation type tracking
    private dragType: 'rotate' | 'pan' | null = null;

    constructor(
        camera: PerspectiveCamera,
        inputManager: LocalInputManager,
        config: OrbitControllerConfig = {}
    ) {
        super(camera);
        this.inputManager = inputManager;
        
        this.config = {
            rotateSensitivity: 0.01,
            panSensitivity: 0.01,
            zoomSensitivity: 0.1,
            minDistance: 1,
            maxDistance: 100,
            minPolarAngle: 0.1,
            maxPolarAngle: Math.PI - 0.1,
            ...config
        };

        this.setupEventListeners();
        this.updateCameraPosition();
    }

    private setupEventListeners(): void {
        this.inputManager.on(EventTypes.MOUSE_DOWN, (event) => this.handleMouseDown(event));
        this.inputManager.on(EventTypes.DRAG, (event) => this.handleDrag(event));
        this.inputManager.on(EventTypes.DRAG_END, (event) => this.handleDragEnd(event));
        this.inputManager.on(EventTypes.WHEEL, (event) => this.handleWheel(event));
    }

    private handleMouseDown(event: InputEvent): void {
        if (!this.enabled) return;

        switch (event.button) {
            case 0: // Left button - rotate
                this.dragType = 'rotate';
                break;
            case 2: // Right button - pan
                this.dragType = 'pan';
                break;
            default:
                this.dragType = null;
        }
    }

    private handleDrag(event: InputEvent): void {
        if (!this.enabled || !this.dragType) return;

        const deltaX = event.delta!.x;
        const deltaY = event.delta!.y;

        if (this.dragType === 'rotate') {
            this.handleRotate(deltaX, deltaY);
        } else if (this.dragType === 'pan') {
            this.handlePan(deltaX, deltaY);
        }
    }

    private handleDragEnd(_event: InputEvent): void {
        this.dragType = null;
    }

    private handleWheel(event: InputEvent): void {
        if (!this.enabled) return;

        const wheelEvent = event.originalEvent as WheelEvent;
        const zoomDelta = wheelEvent.deltaY > 0 ? 1 + this.config.zoomSensitivity : 1 - this.config.zoomSensitivity;
        
        this.distance *= zoomDelta;
        this.distance = Math.max(this.config.minDistance, Math.min(this.config.maxDistance, this.distance));
        
        this.updateCameraPosition();
    }

    private handleRotate(deltaX: number, deltaY: number): void {
        this.azimuthAngle -= deltaX * this.config.rotateSensitivity;
        this.polarAngle -= deltaY * this.config.rotateSensitivity;
        
        this.polarAngle = Math.max(
            this.config.minPolarAngle,
            Math.min(this.config.maxPolarAngle, this.polarAngle)
        );
        
        this.updateCameraPosition();
    }

    private handlePan(deltaX: number, deltaY: number): void {
        const right = new Vector3();
        const up = new Vector3();
        
        const direction = new Vector3();
        this.camera.getWorldDirection(direction);
        
        right.crossVectors(direction, this.camera.up).normalize();
        up.crossVectors(right, direction).normalize();
        
        // /2
        const panX = -deltaX * this.config.panSensitivity * this.distance / 10;
        const panY = deltaY * this.config.panSensitivity * this.distance / 10;
        
        this.target.add(right.multiplyScalar(panX));
        this.target.add(up.multiplyScalar(panY));
        
        this.updateCameraPosition();
    }

    private updateCameraPosition(): void {
        const x = this.target.x + this.distance * Math.sin(this.polarAngle) * Math.sin(this.azimuthAngle);
        const y = this.target.y + this.distance * Math.cos(this.polarAngle);
        const z = this.target.z + this.distance * Math.sin(this.polarAngle) * Math.cos(this.azimuthAngle);
        
        this.camera.position.set(x, y, z);
        this.camera.lookAt(this.target);
    }

    public update(): void {
        // Orbit controller doesn't need per-frame updates in event-driven mode
    }

    public setTarget(target: Vector3): void {
        this.target.copy(target);
        this.updateCameraPosition();
    }

    public getTarget(): Vector3 {
        return this.target.clone();
    }

    public setDistance(distance: number): void {
        this.distance = Math.max(this.config.minDistance, Math.min(this.config.maxDistance, distance));
        this.updateCameraPosition();
    }

    public getDistance(): number {
        return this.distance;
    }

    public setAngles(azimuth: number, polar: number): void {
        this.azimuthAngle = azimuth;
        this.polarAngle = Math.max(
            this.config.minPolarAngle,
            Math.min(this.config.maxPolarAngle, polar)
        );
        this.updateCameraPosition();
    }

    public getAngles(): { azimuth: number; polar: number } {
        return { azimuth: this.azimuthAngle, polar: this.polarAngle };
    }

    public updateConfig(newConfig: Partial<OrbitControllerConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    public getConfig(): Required<OrbitControllerConfig> {
        return { ...this.config };
    }

    public reset(): void {
        this.target.set(0, 0, 0);
        this.distance = 10;
        this.azimuthAngle = 0;
        this.polarAngle = Math.PI / 2;
        this.updateCameraPosition();
    }

    public dispose(): void {
        this.inputManager.off(EventTypes.MOUSE_DOWN, this.handleMouseDown);
        this.inputManager.off(EventTypes.DRAG, this.handleDrag);
        this.inputManager.off(EventTypes.DRAG_END, this.handleDragEnd);
        this.inputManager.off(EventTypes.WHEEL, this.handleWheel);
    }
}
