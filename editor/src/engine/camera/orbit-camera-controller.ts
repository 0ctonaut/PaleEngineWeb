import { PerspectiveCamera, Vector3, Spherical } from 'three/webgpu';
import { clamp } from 'three/src/math/MathUtils.js';

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

// Epsilon value for preventing gimbal lock at poles (same as ViewportGizmo)
const EPSILON = 1e-6;

export class OrbitCameraController extends CameraController {
    private inputManager: LocalInputManager;
    private target: Vector3 = new Vector3(0, 0, 0);
    private spherical: Spherical = new Spherical();
    
    private config: Required<OrbitControllerConfig>;
    
    // Drag operation type tracking
    private dragType: 'rotate' | 'pan' | null = null;
    
    // Temporary vectors for calculations
    private _direction = new Vector3();

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
            minPolarAngle: EPSILON,
            maxPolarAngle: Math.PI - EPSILON,
            ...config
        };

        // Initialize spherical coordinates from camera position
        this._direction.subVectors(this.camera.position, this.target);
        this.spherical.setFromVector3(this._direction);
        
        // Clamp phi to safe range
        this.spherical.phi = clamp(
            this.spherical.phi,
            Math.max(EPSILON, this.config.minPolarAngle),
            Math.min(Math.PI - EPSILON, this.config.maxPolarAngle)
        );

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
        
        this.spherical.radius *= zoomDelta;
        this.spherical.radius = clamp(
            this.spherical.radius,
            this.config.minDistance,
            this.config.maxDistance
        );
        
        this.updateCameraPosition();
    }

    private handleRotate(deltaX: number, deltaY: number): void {
        // Update spherical coordinates
        this.spherical.theta -= deltaX * this.config.rotateSensitivity;
        this.spherical.phi -= deltaY * this.config.rotateSensitivity;
        
        // Clamp phi to safe range to prevent gimbal lock
        const minPhi = Math.max(EPSILON, this.config.minPolarAngle);
        const maxPhi = Math.min(Math.PI - EPSILON, this.config.maxPolarAngle);
        this.spherical.phi = clamp(this.spherical.phi, minPhi, maxPhi);
        
        this.updateCameraPosition();
    }

    private handlePan(deltaX: number, deltaY: number): void {
        const right = new Vector3();
        const up = new Vector3();
        
        this.camera.getWorldDirection(this._direction);
        
        right.crossVectors(this._direction, this.camera.up).normalize();
        up.crossVectors(right, this._direction).normalize();
        
        // Pan distance proportional to current radius
        const panX = -deltaX * this.config.panSensitivity * this.spherical.radius / 10;
        const panY = deltaY * this.config.panSensitivity * this.spherical.radius / 10;
        
        this.target.add(right.multiplyScalar(panX));
        this.target.add(up.multiplyScalar(panY));
        
        this.updateCameraPosition();
    }

    private updateCameraPosition(): void {
        // Ensure phi is within safe range
        const minPhi = Math.max(EPSILON, this.config.minPolarAngle);
        const maxPhi = Math.min(Math.PI - EPSILON, this.config.maxPolarAngle);
        this.spherical.phi = clamp(this.spherical.phi, minPhi, maxPhi);
        
        // Clamp radius
        this.spherical.radius = clamp(
            this.spherical.radius,
            this.config.minDistance,
            this.config.maxDistance
        );
        
        // Update camera position from spherical coordinates
        this.camera.position.setFromSpherical(this.spherical).add(this.target);
        this.camera.lookAt(this.target);
    }

    public update(): void {
        // Orbit controller doesn't need per-frame updates in event-driven mode
    }

    public setTarget(target: Vector3): void {
        this.target.copy(target);
        
        // Recalculate spherical coordinates from new target-camera relationship
        this._direction.subVectors(this.camera.position, this.target);
        this.spherical.setFromVector3(this._direction);
        
        // Clamp phi to safe range
        const minPhi = Math.max(EPSILON, this.config.minPolarAngle);
        const maxPhi = Math.min(Math.PI - EPSILON, this.config.maxPolarAngle);
        this.spherical.phi = clamp(this.spherical.phi, minPhi, maxPhi);
        
        this.updateCameraPosition();
    }

    public getTarget(): Vector3 {
        return this.target.clone();
    }

    public setDistance(distance: number): void {
        this.spherical.radius = clamp(
            distance,
            this.config.minDistance,
            this.config.maxDistance
        );
        this.updateCameraPosition();
    }

    public getDistance(): number {
        return this.spherical.radius;
    }

    public setAngles(azimuth: number, polar: number): void {
        this.spherical.theta = azimuth;
        const minPhi = Math.max(EPSILON, this.config.minPolarAngle);
        const maxPhi = Math.min(Math.PI - EPSILON, this.config.maxPolarAngle);
        this.spherical.phi = clamp(polar, minPhi, maxPhi);
        this.updateCameraPosition();
    }

    public getAngles(): { azimuth: number; polar: number } {
        return { azimuth: this.spherical.theta, polar: this.spherical.phi };
    }

    public updateConfig(newConfig: Partial<OrbitControllerConfig>): void {
        this.config = { ...this.config, ...newConfig };
        
        // Ensure current phi is within new bounds
        const minPhi = Math.max(EPSILON, this.config.minPolarAngle);
        const maxPhi = Math.min(Math.PI - EPSILON, this.config.maxPolarAngle);
        this.spherical.phi = clamp(this.spherical.phi, minPhi, maxPhi);
        
        // Ensure current radius is within new bounds
        this.spherical.radius = clamp(
            this.spherical.radius,
            this.config.minDistance,
            this.config.maxDistance
        );
        
        this.updateCameraPosition();
    }

    public getConfig(): Required<OrbitControllerConfig> {
        return { ...this.config };
    }

    public reset(): void {
        this.target.set(0, 0, 0);
        this.spherical.radius = 10;
        this.spherical.theta = 0;
        this.spherical.phi = Math.PI / 2;
        this.updateCameraPosition();
    }

    public dispose(): void {
        this.inputManager.off(EventTypes.MOUSE_DOWN, this.handleMouseDown);
        this.inputManager.off(EventTypes.DRAG, this.handleDrag);
        this.inputManager.off(EventTypes.DRAG_END, this.handleDragEnd);
        this.inputManager.off(EventTypes.WHEEL, this.handleWheel);
    }
}
