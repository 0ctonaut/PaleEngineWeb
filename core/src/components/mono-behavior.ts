import type { PaleObject } from '../engine/pale-object';

export abstract class MonoBehaviour {
    public gameObject!: PaleObject;

    public enabled: boolean = true;

    public get transform(): PaleObject {
        return this.gameObject;
    }

    public Awake(): void {
        // override
    }

    public Start(): void {
        // override
    }

    public Update(_deltaTime: number): void {
        // override
    }

    public FixedUpdate(_fixedDeltaTime: number): void {
        // override
    }

    public LateUpdate(_deltaTime: number): void {
        // override
    }

    public OnEnable(): void {
        // override
    }

    public OnDisable(): void {
        // override
    }

    public OnDestroy(): void {
        // override
    }
}


