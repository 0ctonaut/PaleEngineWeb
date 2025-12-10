import { AnimationController } from '@paleengine/core';

/**
 * TimeController - Manages global timeline and animation playback
 * 
 * Controls the current time, time range, and synchronizes with all AnimationControllers
 */
export class TimeController {
    private currentTime: number = 0; // Current frame
    private timeRangeBegin: number = 0; // Begin frame
    private timeRangeEnd: number = 100; // End frame
    private fps: number = 30; // Frames per second
    private loopPlayback: boolean = true;
    private isPlaying: boolean = false;
    private animationControllers: AnimationController[] = [];

    /**
     * Set the current time without clamping to range (for dragging beyond end)
     * Always syncs time but doesn't modify playback state
     */
    public setCurrentTimeUnclamped(time: number): void {
        this.currentTime = time;
        // Always sync time to controllers, regardless of range
        // This allows previewing animation at any frame
        this.syncTimeToControllers();
        
        // Note: We don't modify playback state here
        // If playing, animations continue from new position
        // If paused, animations stay paused at new position
    }

    /**
     * Get the current time
     */
    public getCurrentTime(): number {
        return this.currentTime;
    }

    /**
     * Set the time range
     */
    public setTimeRange(begin: number, end: number): void {
        // Ensure begin is not less than 0
        begin = Math.max(0, begin);
        end = Math.max(begin, end);
        
        this.timeRangeBegin = Math.min(begin, end);
        this.timeRangeEnd = Math.max(begin, end);
        
        // Clamp current time to new range
        if (this.currentTime < this.timeRangeBegin) {
            this.currentTime = this.timeRangeBegin;
        } else if (this.currentTime > this.timeRangeEnd) {
            this.currentTime = this.timeRangeEnd;
        }
        
        this.syncTimeToControllers();
    }

    /**
     * Get the time range
     */
    public getTimeRange(): { begin: number; end: number } {
        return { begin: this.timeRangeBegin, end: this.timeRangeEnd };
    }

    /**
     * Set loop playback mode
     */
    public setLoopPlayback(loop: boolean): void {
        this.loopPlayback = loop;
    }

    /**
     * Get loop playback mode
     */
    public getLoopPlayback(): boolean {
        return this.loopPlayback;
    }

    /**
     * Start playback
     */
    public play(): void {
        this.isPlaying = true;
        this.animationControllers.forEach(controller => {
            if (controller.getTimeScale() === 0) {
                controller.resume();
            } else {
                controller.play();
            }
        });
    }

    /**
     * Pause playback
     */
    public pause(): void {
        this.isPlaying = false;
        this.animationControllers.forEach(controller => {
            controller.pause();
        });
    }

    /**
     * Check if currently playing
     */
    public getIsPlaying(): boolean {
        return this.isPlaying;
    }

    /**
     * Set frames per second
     */
    public setFPS(fps: number): void {
        this.fps = Math.max(1, Math.min(120, fps));
    }

    /**
     * Get frames per second
     */
    public getFPS(): number {
        return this.fps;
    }

    /**
     * Update logic - should be called every frame
     * deltaTime is in seconds, converts to frames based on FPS
     */
    public update(deltaTime: number): void {
        if (this.isPlaying) {
            // Convert deltaTime (seconds) to frames based on FPS
            // e.g., if FPS=30, then 1 second = 30 frames, so deltaTime=1.0 means +30 frames
            const deltaFrames = deltaTime * this.fps;
            this.currentTime += deltaFrames;
            
            // Handle loop or clamp - ensure time stays within begin and end range during playback
            if (this.currentTime > this.timeRangeEnd) {
                if (this.loopPlayback) {
                    this.currentTime = this.timeRangeBegin;
                } else {
                    this.currentTime = this.timeRangeEnd;
                    this.pause();
                }
            } else if (this.currentTime < this.timeRangeBegin) {
                // If somehow time goes below begin, clamp to begin
                this.currentTime = this.timeRangeBegin;
            }
            
            this.syncTimeToControllers();
        }
    }

    /**
     * Register an AnimationController
     */
    public registerAnimationController(controller: AnimationController): void {
        if (!this.animationControllers.includes(controller)) {
            this.animationControllers.push(controller);
            // Sync current time to the new controller (convert frames to seconds)
            const timeInSeconds = this.currentTime / this.fps;
            controller.setTime(timeInSeconds);
        }
    }

    /**
     * Unregister an AnimationController
     */
    public unregisterAnimationController(controller: AnimationController): void {
        const index = this.animationControllers.indexOf(controller);
        if (index > -1) {
            this.animationControllers.splice(index, 1);
        }
    }

    /**
     * Get all registered AnimationControllers
     */
    public getAnimationControllers(): AnimationController[] {
        return [...this.animationControllers];
    }

    /**
     * Synchronize current time to all AnimationControllers
     * Converts frames to seconds: timeInSeconds = frames / fps
     */
    private syncTimeToControllers(): void {
        // Convert frames to seconds for AnimationController (which uses seconds)
        const timeInSeconds = this.currentTime / this.fps;
        this.animationControllers.forEach(controller => {
            controller.setTime(timeInSeconds);
        });
    }
}

