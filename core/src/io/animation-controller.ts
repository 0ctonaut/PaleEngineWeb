import { 
    Object3D, 
    AnimationClip, 
    AnimationMixer, 
    AnimationAction 
} from 'three/webgpu';

/**
 * Animation information for a single animation clip
 */
export interface AnimationInfo {
    name: string;
    duration: number;
    action: AnimationAction;
}

/**
 * AnimationController - Controls animations for a 3D model
 * 
 * This class wraps Three.js AnimationMixer to provide a simple API
 * for controlling animations loaded from GLB files.
 */
export class AnimationController {
    private readonly mixer: AnimationMixer;
    private readonly animations: Map<string, AnimationAction>;
    private readonly animationInfos: AnimationInfo[];
    private isPlaying: boolean = false;
    //private currentTime: number = 0;

    /**
     * Creates a new AnimationController
     * 
     * @param root - The root Object3D that contains the animations
     * @param clips - Array of AnimationClip objects from the loaded GLB
     */
    constructor(root: Object3D, clips: AnimationClip[]) {
        this.mixer = new AnimationMixer(root);
        this.animations = new Map();
        this.animationInfos = [];

        // Create actions for all animation clips
        clips.forEach((clip) => {
            const action = this.mixer.clipAction(clip);
            this.animations.set(clip.name, action);
            this.animationInfos.push({
                name: clip.name,
                duration: clip.duration,
                action: action
            });
        });
    }

    /**
     * Get all animation information
     * 
     * @returns Array of animation info objects
     */
    public getAnimations(): AnimationInfo[] {
        return [...this.animationInfos];
    }

    /**
     * Get animation info by name
     * 
     * @param name - Animation name
     * @returns Animation info or undefined if not found
     */
    public getAnimation(name: string): AnimationInfo | undefined {
        return this.animationInfos.find(info => info.name === name);
    }

    /**
     * Play an animation by name, or all animations if no name is provided
     * 
     * @param animationName - Optional animation name. If not provided, plays all animations
     * @param timeScale - Optional time scale (1.0 = normal speed, 2.0 = 2x speed, etc.)
     */
    public play(animationName?: string, timeScale: number = 1.0): void {
        if (animationName) {
            const action = this.animations.get(animationName);
            if (action) {
                action.timeScale = timeScale;
                action.play();
                this.isPlaying = true;
            } else {
                console.warn(`Animation "${animationName}" not found`);
            }
        } else {
            // Play all animations
            this.animations.forEach((action) => {
                action.timeScale = timeScale;
                action.play();
            });
            this.isPlaying = true;
        }
    }

    /**
     * Stop an animation by name, or all animations if no name is provided
     * 
     * @param animationName - Optional animation name. If not provided, stops all animations
     */
    public stop(animationName?: string): void {
        if (animationName) {
            const action = this.animations.get(animationName);
            if (action) {
                action.stop();
            }
        } else {
            this.mixer.stopAllAction();
            this.isPlaying = false;
        }
    }

    /**
     * Pause all animations (sets timeScale to 0)
     */
    public pause(): void {
        this.mixer.timeScale = 0;
    }

    /**
     * Resume all animations (sets timeScale back to 1)
     */
    public resume(): void {
        // 如果从未播放过，需要先播放
        if (!this.isPlaying) {
            this.play();
        } else {
            // 如果已经播放过，只是恢复时间缩放
            this.mixer.timeScale = 1.0;
        }
    }

    /**
     * Set the global time scale for all animations
     * 
     * @param timeScale - Time scale (1.0 = normal speed, 2.0 = 2x speed, 0 = paused)
     */
    public setTimeScale(timeScale: number): void {
        this.mixer.timeScale = timeScale;
    }

    /**
     * Get the current global time scale
     * 
     * @returns Current time scale
     */
    public getTimeScale(): number {
        return this.mixer.timeScale;
    }

    /**
     * Set the global mixer time (affects all animations)
     * 
     * @param time - Time in seconds
     */
    public setTime(time: number): void {
        //this.currentTime = time;
        this.mixer.setTime(time);
    }

    /**
     * Get the current global mixer time
     * 
     * @returns Current time in seconds
     */
    public getTime(): number {
        return this.mixer.time;
    }

    /**
     * Set the time for a specific animation
     * 
     * @param animationName - Animation name
     * @param time - Time in seconds
     */
    public setAnimationTime(animationName: string, time: number): void {
        const action = this.animations.get(animationName);
        if (action) {
            action.time = time;
        } else {
            console.warn(`Animation "${animationName}" not found`);
        }
    }

    /**
     * Get the current time for a specific animation
     * 
     * @param animationName - Animation name
     * @returns Current time in seconds, or undefined if animation not found
     */
    public getAnimationTime(animationName: string): number | undefined {
        const action = this.animations.get(animationName);
        return action ? action.time : undefined;
    }

    /**
     * Update the animation mixer (should be called every frame)
     * 
     * @param deltaTime - Time delta in seconds since last update
     */
    public update(deltaTime: number): void {
        this.mixer.update(deltaTime);
        //this.currentTime = this.mixer.time;
    }

    /**
     * Check if any animation is currently playing
     * 
     * @returns True if playing, false otherwise
     */
    public isAnimating(): boolean {
        return this.isPlaying && this.mixer.timeScale !== 0;
    }

    /**
     * Get the maximum duration among all animations
     * 
     * @returns Maximum duration in seconds
     */
    public getMaxDuration(): number {
        if (this.animationInfos.length === 0) {
            return 0;
        }
        return Math.max(...this.animationInfos.map(info => info.duration));
    }

    /**
     * Reset all animations to the beginning
     */
    public reset(): void {
        this.animations.forEach((action) => {
            action.reset();
        });
        this.setTime(0);
    }

    /**
     * Dispose of the animation controller and free resources
     */
    public dispose(): void {
        this.stop();
        this.animations.forEach((action) => {
            action.stop();
        });
        this.animations.clear();
        this.animationInfos.length = 0;
    }

    /**
     * Get the underlying AnimationMixer (for advanced usage)
     * 
     * @returns The AnimationMixer instance
     */
    public getMixer(): AnimationMixer {
        return this.mixer;
    }
}

