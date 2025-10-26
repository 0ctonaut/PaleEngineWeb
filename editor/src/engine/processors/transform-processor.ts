import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { Mesh, Object3D } from 'three/webgpu';
import { InputProcessor } from './input-processor';
import { EventTypes, InputEvent, Keys } from '../input';
import { TransformCommand, TransformState } from '../commands';
import { Layers, SelectionCategory } from '@paleengine/core';

export class TransformProcessor extends InputProcessor {
  private controls: TransformControls;
  private currentAttachment: Object3D | null = null;
  private initialTransform: TransformState | null = null;
  private isTransforming: boolean = false;
  private boundKeyDownHandler: (event: InputEvent) => void;

  constructor(world: any, inputManager: any) {
    super(world, inputManager);
    
    // Bind event handlers
    this.boundKeyDownHandler = this.handleKeyDown.bind(this);
    
    // Initialize TransformControls
    this.controls = new TransformControls(
      this.world.getCamera(),
      this.world.getRenderer().domElement
    );
    
    this.setupTransformControls();
    this.setupInputHandlers();
    
    // Configure gizmo helper
    const helper = this.controls.getHelper();
    
    // Set to UI rendering layer
    helper.layers.set(Layers.UI);
    
    // Mark entire gizmo hierarchy as non-selectable UI helper
    helper.userData.selectionCategory = SelectionCategory.UI_HELPER;
    helper.traverse((child) => {
      child.userData.selectionCategory = SelectionCategory.UI_HELPER;
    });
    
    // Add controls to scene
    this.world.getScene().add(helper);
  }

  private setupTransformControls(): void {
    // Initially hide the gizmo
    this.controls.getHelper().visible = false;
    
    // Listen for dragging state changes to coordinate with camera
    this.controls.addEventListener('dragging-changed', (event: any) => {
      const cameraController = this.world.getCameraController();
      if (event.value) {
        cameraController.disable();
      } else {
        cameraController.enable();
      }
      
      if (event.value) {
        this.isTransforming = true;
        this.captureInitialTransform();
      } else {
        this.isTransforming = false;
        this.recordTransformCommand();
      }
    });

    // Set initial mode to translate
    this.controls.setMode('translate');
  }

  protected setupInputHandlers(): void {
    // Keyboard shortcuts for mode switching
    this.inputManager.on(EventTypes.KEY_DOWN, this.boundKeyDownHandler);
  }

  private handleKeyDown(event: InputEvent): void {
    // Only handle mode switching if processor is enabled and we have an attached object
    if (!this.enabled || !this.currentAttachment) return;
    
    const keyboardEvent = event.originalEvent as KeyboardEvent;
    const code = keyboardEvent.code;

    switch (code) {
      case Keys.W:
        this.controls.setMode('translate');
        event.preventDefault();
        break;
      case Keys.E:
        this.controls.setMode('rotate');
        event.preventDefault();
        break;
      case Keys.R:
        this.controls.setMode('scale');
        event.preventDefault();
        break;
    }
  }

  public update(_deltaTime: number): void {
    // Check for selection changes and update attachment
    const selectedMesh = this.world.getSelectedMesh();
    if (selectedMesh !== this.currentAttachment) {
      this.updateAttachment(selectedMesh);
    }
  }

  private updateAttachment(mesh: Mesh | null): void {
    if (mesh) {
      this.controls.attach(mesh);
      this.controls.getHelper().visible = true;
      this.currentAttachment = mesh;
    } else {
      this.controls.detach();
      this.controls.getHelper().visible = false;
      this.currentAttachment = null;
    }
  }

  private captureInitialTransform(): void {
    if (this.currentAttachment) {
      this.initialTransform = TransformCommand.captureTransform(this.currentAttachment);
    }
  }

  private recordTransformCommand(): void {
    if (!this.currentAttachment || !this.initialTransform) return;

    const currentTransform = TransformCommand.captureTransform(this.currentAttachment);
    
    // Only create command if transform actually changed
    if (this.hasTransformChanged(this.initialTransform, currentTransform)) {
      const command = new TransformCommand(
        this.currentAttachment,
        this.initialTransform,
        currentTransform
      );
      
      this.world.getCommandManager().execute(command);
    }
    
    this.initialTransform = null;
  }

  private hasTransformChanged(oldTransform: TransformState, newTransform: TransformState): boolean {
    const threshold = 0.001; // Small threshold for floating point comparison
    
    return !oldTransform.position.equals(newTransform.position) ||
           !oldTransform.rotation.equals(newTransform.rotation) ||
           !oldTransform.scale.equals(newTransform.scale) ||
           Math.abs(oldTransform.position.distanceTo(newTransform.position)) > threshold ||
           Math.abs(oldTransform.rotation.x - newTransform.rotation.x) > threshold ||
           Math.abs(oldTransform.rotation.y - newTransform.rotation.y) > threshold ||
           Math.abs(oldTransform.rotation.z - newTransform.rotation.z) > threshold ||
           Math.abs(oldTransform.scale.x - newTransform.scale.x) > threshold ||
           Math.abs(oldTransform.scale.y - newTransform.scale.y) > threshold ||
           Math.abs(oldTransform.scale.z - newTransform.scale.z) > threshold;
  }

  public getCurrentMode(): string {
    return this.controls.mode;
  }

  public setMode(mode: 'translate' | 'rotate' | 'scale'): void {
    this.controls.setMode(mode);
  }

  public getAttachedObject(): Object3D | null {
    return this.currentAttachment;
  }

  public isDragging(): boolean {
    return this.isTransforming;
  }

  public dispose(): void {
    this.inputManager.off(EventTypes.KEY_DOWN, this.boundKeyDownHandler);
    
    this.world.getScene().remove(this.controls.getHelper());
    
    this.controls.dispose();
    
    this.currentAttachment = null;
    this.initialTransform = null;
  }
}
