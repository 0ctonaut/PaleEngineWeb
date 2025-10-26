import { Object3D, Vector3, Euler } from 'three/webgpu';
import { Command } from './command';

export interface TransformState {
  position: Vector3;
  rotation: Euler;
  scale: Vector3;
}

export class TransformCommand implements Command {
  private object: Object3D;
  private oldTransform: TransformState;
  private newTransform: TransformState;

  constructor(object: Object3D, oldTransform: TransformState, newTransform: TransformState) {
    this.object = object;
    this.oldTransform = {
      position: oldTransform.position.clone(),
      rotation: oldTransform.rotation.clone(),
      scale: oldTransform.scale.clone()
    };
    this.newTransform = {
      position: newTransform.position.clone(),
      rotation: newTransform.rotation.clone(),
      scale: newTransform.scale.clone()
    };
  }

  execute(): void {
    this.applyTransform(this.newTransform);
  }

  undo(): void {
    this.applyTransform(this.oldTransform);
  }

  private applyTransform(transform: TransformState): void {
    this.object.position.copy(transform.position);
    this.object.rotation.copy(transform.rotation);
    this.object.scale.copy(transform.scale);
    
    // Update matrix to ensure changes are applied
    this.object.updateMatrix();
  }

  public static captureTransform(object: Object3D): TransformState {
    return {
      position: object.position.clone(),
      rotation: object.rotation.clone(),
      scale: object.scale.clone()
    };
  }
}
