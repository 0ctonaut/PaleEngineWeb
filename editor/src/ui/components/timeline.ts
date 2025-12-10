import { TimeController } from '../../engine/time-controller';
import { LocalInputManager, InputContext, EventTypes, InputEvent, MouseButton } from '../../engine/input';

export class TimelineUI {
    private element!: HTMLElement;
    private controlsContainer!: HTMLElement;
    private numbersContainer!: HTMLElement;
    private rulerContainer!: HTMLElement;
    private canvas!: HTMLCanvasElement;
    private ctx!: CanvasRenderingContext2D;
    private pointer!: HTMLElement;
    private pointerLabel!: HTMLElement;
    private rangeBg!: HTMLElement;
    private numberLabels: Map<number, HTMLElement> = new Map(); // Store number label elements
    
    // Controls
    private playPauseButton!: HTMLElement;
    private beginInput!: HTMLInputElement;
    private endInput!: HTMLInputElement;
    private fpsInput!: HTMLInputElement;
    private currentFrameInput!: HTMLInputElement;
    private lastCurrentFrameValue: string = '0'; // Store last frame value to avoid unnecessary updates
    
    private timeController: TimeController;
    
    // View state
    private viewStart: number = 0;
    private viewEnd: number = 60;
    
    // Interaction state
    private isDragging: boolean = false;
    private isDraggingPointer: boolean = false;
    private dragStartX: number = 0;
    private dragStartViewStart: number = 0;
    private dragStartViewDuration: number = 0; // Store view duration at drag start to prevent scaling
    private draggingButton: number | null = null; // Track which button is being dragged
    
    // Input manager
    private inputManager: LocalInputManager | null = null;
    private inputContext: InputContext | null = null;
    
    
    constructor(timeController: TimeController) {
        this.timeController = timeController;
        
        // Initialize view range based on TimeController's time range with 10% margin on each side
        const range = timeController.getTimeRange();
        const duration = range.end - range.begin;
        const margin = 0.1 * duration;
        this.viewStart = range.begin - margin;
        this.viewEnd = range.end + margin;
        
        this.createTimeline();
        this.bindEvents();
        // Initial render
        this.render();
    }
    
    private createTimeline(): void {
        this.element = document.createElement('div');
        this.element.className = 'timeline-container';
        
        // First row: Controls
        this.createControlsRow();
        
        // Second row: Numbers bar
        this.createNumbersRow();
        
        // Third row: Ruler bar
        this.createRulerRow();
        
        // Initial render
        this.updateCanvasSize();
        this.render();
    }
    
    private createControlsRow(): void {
        this.controlsContainer = document.createElement('div');
        this.controlsContainer.className = 'timeline-controls';
        
        // Play/Pause button
        this.playPauseButton = document.createElement('button');
        this.playPauseButton.className = 'timeline-button play-pause-button';
        this.playPauseButton.innerHTML = '▶';
        this.updateButtonState();
        
        // Begin input
        const beginLabel = document.createElement('label');
        beginLabel.textContent = 'Begin:';
        beginLabel.className = 'time-range-label';
        
        this.beginInput = document.createElement('input');
        this.beginInput.type = 'number';
        this.beginInput.className = 'time-range-input begin';
        const range = this.timeController.getTimeRange();
        this.beginInput.value = range.begin.toString();
        
        // End input
        const endLabel = document.createElement('label');
        endLabel.textContent = 'End:';
        endLabel.className = 'time-range-label';
        
        this.endInput = document.createElement('input');
        this.endInput.type = 'number';
        this.endInput.className = 'time-range-input end';
        this.endInput.value = range.end.toString();
        
        // FPS input
        const fpsLabel = document.createElement('label');
        fpsLabel.textContent = 'FPS:';
        fpsLabel.className = 'time-range-label';
        
        this.fpsInput = document.createElement('input');
        this.fpsInput.type = 'number';
        this.fpsInput.className = 'time-range-input fps';
        this.fpsInput.value = '30';
        this.fpsInput.min = '1';
        this.fpsInput.max = '120';
        
        // Current frame input
        const currentFrameLabel = document.createElement('label');
        currentFrameLabel.textContent = 'Frame:';
        currentFrameLabel.className = 'time-range-label';
        
        this.currentFrameInput = document.createElement('input');
        this.currentFrameInput.type = 'number';
        this.currentFrameInput.className = 'time-range-input current-frame';
        this.currentFrameInput.value = '0';
        this.currentFrameInput.min = '0';
        this.lastCurrentFrameValue = '0';
        
        this.controlsContainer.appendChild(this.playPauseButton);
        this.controlsContainer.appendChild(beginLabel);
        this.controlsContainer.appendChild(this.beginInput);
        this.controlsContainer.appendChild(endLabel);
        this.controlsContainer.appendChild(this.endInput);
        this.controlsContainer.appendChild(fpsLabel);
        this.controlsContainer.appendChild(this.fpsInput);
        this.controlsContainer.appendChild(currentFrameLabel);
        this.controlsContainer.appendChild(this.currentFrameInput);
        this.element.appendChild(this.controlsContainer);
    }
    
    private createNumbersRow(): void {
        this.numbersContainer = document.createElement('div');
        this.numbersContainer.className = 'timeline-numbers';
        
        // Range background (begin/end range)
        this.rangeBg = document.createElement('div');
        this.rangeBg.className = 'timeline-range-bg';
        
        // Current time pointer
        this.pointer = document.createElement('div');
        this.pointer.className = 'timeline-pointer';
        
        // Pointer label
        this.pointerLabel = document.createElement('div');
        this.pointerLabel.className = 'timeline-pointer-label';
        this.pointer.appendChild(this.pointerLabel);
        
        this.numbersContainer.appendChild(this.rangeBg);
        this.numbersContainer.appendChild(this.pointer);
        this.element.appendChild(this.numbersContainer);
    }
    
    private createRulerRow(): void {
        this.rulerContainer = document.createElement('div');
        this.rulerContainer.className = 'timeline-ruler-container';
        
        // Canvas for rendering ruler
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'timeline-ruler';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.ctx = this.canvas.getContext('2d')!;
        
        this.rulerContainer.appendChild(this.canvas);
        this.element.appendChild(this.rulerContainer);
    }
    
    private updateCanvasSize(): void {
        const rect = this.rulerContainer.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
    
    private bindEvents(): void {
        // Setup InputManager to handle all events
        this.setupInputManager();
        
        // Controls events
        this.playPauseButton.addEventListener('click', () => {
            this.togglePlayPause();
        });
        
        this.beginInput.addEventListener('change', () => {
            this.handleTimeRangeChange();
        });
        this.beginInput.addEventListener('blur', () => {
            this.handleTimeRangeChange();
        });
        
        this.endInput.addEventListener('change', () => {
            this.handleTimeRangeChange();
        });
        this.endInput.addEventListener('blur', () => {
            this.handleTimeRangeChange();
        });
        
        // FPS input handlers
        this.fpsInput.addEventListener('change', () => {
            this.handleFPSChange();
        });
        this.fpsInput.addEventListener('blur', () => {
            this.handleFPSChange();
        });
        
        // Current frame input handlers
        this.currentFrameInput.addEventListener('change', () => {
            this.handleCurrentFrameChange();
        });
        this.currentFrameInput.addEventListener('blur', () => {
            this.handleCurrentFrameChange();
        });
        
        // Pointer drag (needs separate handler since pointer is a child element)
        this.pointer.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            if (e.button === 0) { // Only left mouse button
                this.isDraggingPointer = true;
                this.dragStartX = e.clientX;
            }
        });
        
        // Mouse move for pointer dragging (needs document-level listener for dragging outside element)
        document.addEventListener('mousemove', (e) => {
            if (this.isDraggingPointer) {
                this.handlePointerDrag(e);
            } else {
                // Update pointer position based on current time
                this.updatePointerPosition();
            }
        });
        
        // Mouse up for pointer dragging
        document.addEventListener('mouseup', () => {
            this.isDraggingPointer = false;
        });
        
        // Resize observer
        const resizeObserver = new ResizeObserver(() => {
            this.updateCanvasSize();
            this.render();
        });
        resizeObserver.observe(this.rulerContainer);
    }
    
    private setupInputManager(): void {
        const context = new InputContext({
            name: 'timeline',
            priority: 10
        });
        context.activate();
        this.inputContext = context;
        
        // Configure InputManager for numbers bar (left button for pointer dragging, middle button for panning)
        this.inputManager = new LocalInputManager(this.numbersContainer, context, {
            dragConfig: {
                threshold: 5,
                button: [MouseButton.LEFT, MouseButton.MIDDLE] // Left for pointer dragging, middle for panning
            }
        });
        
        // Also bind to ruler container for middle button panning
        const rulerInputManager = new LocalInputManager(this.rulerContainer, context, {
            dragConfig: {
                threshold: 5,
                button: [MouseButton.MIDDLE] // Only middle button for panning
            }
        });
        
        // Handle ruler-specific events
        this.setupRulerInputManager(rulerInputManager);
        
        // Handle wheel for zooming
        this.inputManager.on(EventTypes.WHEEL, (event: InputEvent) => {
            // 如果正在中键拖拽，阻止缩放
            if (this.isDragging && this.draggingButton === MouseButton.MIDDLE) {
                event.preventDefault();
                return;
            }
            
            const wheelEvent = event.originalEvent as WheelEvent;
            wheelEvent.preventDefault();
            this.handleWheel(wheelEvent);
        });
        
        // Handle mouse down in numbers bar
        this.inputManager.on(EventTypes.MOUSE_DOWN, (event: InputEvent) => {
            if (event.button === MouseButton.MIDDLE) {
                // Middle button: start panning
                this.isDragging = true;
                this.draggingButton = MouseButton.MIDDLE;
                this.dragStartX = event.globalPosition.x;
                this.dragStartViewStart = this.viewStart;
                this.dragStartViewDuration = this.viewEnd - this.viewStart; // Save view duration
            } else if (event.button === MouseButton.LEFT) {
                // Left button: pointer dragging
                // Check if clicking on pointer
                const pointerRect = this.pointer.getBoundingClientRect();
                const pointerCenterX = pointerRect.left + pointerRect.width / 2;
                const clickX = event.globalPosition.x;
                
                if (Math.abs(clickX - pointerCenterX) < 10) {
                    // Clicked on pointer - handled by pointer's own mousedown listener
                    return;
                }
                
                // Clicked on numbers bar - jump to time and start dragging
                const clickTime = this.pixelToTime(event.position.x);
                const snappedTime = Math.round(clickTime);
                // Use setCurrentTimeUnclamped to allow clicking beyond end
                this.timeController.setCurrentTimeUnclamped(snappedTime);
                this.isDraggingPointer = true;
                this.updatePointerPosition();
            }
        });
        
        // Handle drag events
        this.inputManager.on(EventTypes.DRAG_START, () => {
            // Drag start handled in MOUSE_DOWN
        });
        
        this.inputManager.on(EventTypes.DRAG, (event: InputEvent) => {
            // Handle middle button panning in numbers bar
            if (this.isDragging && this.draggingButton === MouseButton.MIDDLE) {
                const deltaX = event.globalPosition.x - this.dragStartX;
                const rect = this.numbersContainer.getBoundingClientRect();
                const pixelsPerFrame = rect.width / this.dragStartViewDuration;
                const deltaFrames = -deltaX / pixelsPerFrame;
                this.viewStart = this.dragStartViewStart + deltaFrames;
                this.viewEnd = this.viewStart + this.dragStartViewDuration; // Keep duration constant
                this.render();
            }
            // Handle pointer dragging in numbers bar
            else if (this.isDraggingPointer && event.button === MouseButton.LEFT) {
                const mouseTime = this.pixelToTime(event.position.x);
                const snappedTime = Math.round(mouseTime);
                const currentTime = this.timeController.getCurrentTime();
                
                // Only update if snapped time is different (discrete snapping)
                // Use setCurrentTimeUnclamped to allow dragging beyond end
                if (Math.round(currentTime) !== snappedTime) {
                    this.timeController.setCurrentTimeUnclamped(snappedTime);
                    this.updatePointerPosition();
                }
            }
        });
        
        this.inputManager.on(EventTypes.DRAG_END, () => {
            if (this.draggingButton === MouseButton.MIDDLE) {
                this.isDragging = false;
                this.draggingButton = null;
            }
        });
        
        this.inputManager.on(EventTypes.MOUSE_UP, () => {
            if (this.draggingButton === MouseButton.MIDDLE) {
                this.isDragging = false;
                this.draggingButton = null;
            }
        });
        
        // Handle click to jump to time (in numbers bar)
        this.inputManager.on(EventTypes.CLICK, (event: InputEvent) => {
            if (!this.isDragging && !this.isDraggingPointer && event.button === MouseButton.LEFT) {
                const clickX = event.position.x;
                const clickTime = this.pixelToTime(clickX);
                const snappedTime = Math.round(clickTime);
                // Use setCurrentTimeUnclamped to allow clicking beyond end
                this.timeController.setCurrentTimeUnclamped(snappedTime);
                this.updatePointerPosition();
            }
        });
        
        // Handle mouse move for pointer position updates
        this.inputManager.on(EventTypes.MOUSE_MOVE, () => {
            // Update pointer position based on current time
            this.updatePointerPosition();
        });
    }
    
    private setupRulerInputManager(rulerInputManager: LocalInputManager): void {
        // Handle middle button drag for panning in ruler
        rulerInputManager.on(EventTypes.MOUSE_DOWN, (event: InputEvent) => {
            if (event.button === MouseButton.MIDDLE) {
                this.isDragging = true;
                this.draggingButton = MouseButton.MIDDLE;
                this.dragStartX = event.globalPosition.x;
                this.dragStartViewStart = this.viewStart;
                this.dragStartViewDuration = this.viewEnd - this.viewStart; // Save view duration
            }
        });
        
        rulerInputManager.on(EventTypes.DRAG, (event: InputEvent) => {
            if (this.isDragging && this.draggingButton === MouseButton.MIDDLE) {
                const deltaX = event.globalPosition.x - this.dragStartX;
                const rect = this.rulerContainer.getBoundingClientRect();
                const pixelsPerFrame = rect.width / this.dragStartViewDuration;
                const deltaFrames = -deltaX / pixelsPerFrame;
                this.viewStart = this.dragStartViewStart + deltaFrames;
                this.viewEnd = this.viewStart + this.dragStartViewDuration; // Keep duration constant
                this.render();
            }
        });
        
        rulerInputManager.on(EventTypes.DRAG_END, () => {
            if (this.draggingButton === MouseButton.MIDDLE) {
                this.isDragging = false;
                this.draggingButton = null;
            }
        });
        
        rulerInputManager.on(EventTypes.MOUSE_UP, () => {
            if (this.draggingButton === MouseButton.MIDDLE) {
                this.isDragging = false;
                this.draggingButton = null;
            }
        });
        
        // Handle wheel for zooming in ruler
        rulerInputManager.on(EventTypes.WHEEL, (event: InputEvent) => {
            // If middle button dragging, prevent zooming
            if (this.isDragging && this.draggingButton === MouseButton.MIDDLE) {
                event.preventDefault();
                return;
            }
            
            const wheelEvent = event.originalEvent as WheelEvent;
            wheelEvent.preventDefault();
            this.handleWheel(wheelEvent);
        });
    }
    
    private handleWheel(e: WheelEvent): void {
        // Use numbersContainer for consistent coordinate calculation (both bars have same width)
        const rect = this.numbersContainer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        // Calculate time from pixel position
        const ratio = mouseX / rect.width;
        const mouseTime = this.viewStart + (this.viewEnd - this.viewStart) * ratio;
        
        const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
        const viewDuration = this.viewEnd - this.viewStart;
        const newViewDuration = viewDuration * zoomFactor;
        
        // Keep mouse position at the same time
        const centerRatio = mouseX / rect.width;
        const newViewStart = mouseTime - newViewDuration * centerRatio;
        const newViewEnd = newViewStart + newViewDuration;
        
        this.viewStart = newViewStart;
        this.viewEnd = newViewEnd;
        
        this.render();
    }
    
    private handlePointerDrag(e: MouseEvent): void {
        // Use absolute position instead of offset
        const rect = this.numbersContainer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        // Allow dragging beyond bounds for proper time calculation
        const clampedX = Math.max(0, Math.min(rect.width, mouseX));
        const mouseTime = this.pixelToTime(clampedX);
        // Snap to integer
        const snappedTime = Math.round(mouseTime);
        const currentTime = this.timeController.getCurrentTime();
        
        // Only update if snapped time is different (discrete snapping)
        // Use setCurrentTimeUnclamped to allow dragging beyond end
        if (Math.round(currentTime) !== snappedTime) {
            this.timeController.setCurrentTimeUnclamped(snappedTime);
            this.updatePointerPosition();
        }
    }
    
    private pixelToTime(pixelX: number): number {
        const rect = this.numbersContainer.getBoundingClientRect();
        const ratio = pixelX / rect.width;
        return this.viewStart + (this.viewEnd - this.viewStart) * ratio;
    }
    
    private timeToPixel(time: number): number {
        const rect = this.numbersContainer.getBoundingClientRect();
        const ratio = (time - this.viewStart) / (this.viewEnd - this.viewStart);
        return ratio * rect.width;
    }
    
    public render(): void {
        const rect = this.rulerContainer.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, width, height);
        
        // Calculate tick interval
        const viewDuration = this.viewEnd - this.viewStart;
        const pixelsPerFrame = width / viewDuration;
        
        // Determine appropriate tick interval (minimum unit is 1 frame)
        let tickInterval = 1;
        if (pixelsPerFrame > 20) {
            tickInterval = 1;
        } else if (pixelsPerFrame > 10) {
            tickInterval = 5;
        } else if (pixelsPerFrame > 5) {
            tickInterval = 10;
        } else {
            tickInterval = 20;
        }
        
        // Draw major ticks and labels
        const firstTick = Math.ceil(this.viewStart / tickInterval) * tickInterval;
        const lastTick = Math.floor(this.viewEnd / tickInterval) * tickInterval;
        
        this.ctx.strokeStyle = '#666';
        
        // Update number labels in numbers bar
        const labelsToKeep = new Set<number>();
        
        for (let time = firstTick; time <= lastTick; time += tickInterval) {
            const x = this.timeToPixel(time);
            labelsToKeep.add(time);
            
            // Draw major tick (only line, no label on canvas)
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
            
            // Create or update number label in numbers bar
            let labelElement = this.numberLabels.get(time);
            if (!labelElement) {
                labelElement = document.createElement('div');
                labelElement.className = 'timeline-number-label';
                this.numbersContainer.appendChild(labelElement);
                this.numberLabels.set(time, labelElement);
            }
            labelElement.textContent = time.toString();
            labelElement.style.left = `${x}px`;
        }
        
        // Remove labels that are no longer visible
        for (const [time, labelElement] of this.numberLabels.entries()) {
            if (!labelsToKeep.has(time)) {
                labelElement.remove();
                this.numberLabels.delete(time);
            }
        }
        
        // Draw minor ticks (if zoomed in enough)
        if (tickInterval >= 1) {
            const minorInterval = tickInterval / 5;
            const firstMinor = Math.ceil(this.viewStart / minorInterval) * minorInterval;
            const lastMinor = Math.floor(this.viewEnd / minorInterval) * minorInterval;
            
            this.ctx.strokeStyle = '#999';
            this.ctx.lineWidth = 0.5;
            
            for (let time = firstMinor; time <= lastMinor; time += minorInterval) {
                // Skip major ticks
                if (Math.abs(time % tickInterval) < 0.001) continue;
                
                const x = this.timeToPixel(time);
                this.ctx.beginPath();
                this.ctx.moveTo(x, height * 0.5);
                this.ctx.lineTo(x, height);
                this.ctx.stroke();
            }
            
            this.ctx.lineWidth = 1;
        }
        
        // Update range background position
        const range = this.timeController.getTimeRange();
        const rangeStartX = this.timeToPixel(range.begin);
        const rangeEndX = this.timeToPixel(range.end);
        this.rangeBg.style.left = `${rangeStartX}px`;
        this.rangeBg.style.width = `${rangeEndX - rangeStartX}px`;
        
        // Update pointer position
        this.updatePointerPosition();
    }
    
    private updatePointerPosition(): void {
        const currentTime = this.timeController.getCurrentTime();
        // Always snap to integer for display and position
        const snappedTime = Math.round(currentTime);
        const x = this.timeToPixel(snappedTime);
        this.pointer.style.left = `${x}px`;
        
        // Update pointer label with integer value
        this.pointerLabel.textContent = snappedTime.toString();
        
        // Update current frame input only if value has changed
        const newFrameValue = snappedTime.toString();
        if (this.lastCurrentFrameValue !== newFrameValue) {
            this.currentFrameInput.value = newFrameValue;
            this.lastCurrentFrameValue = newFrameValue;
        }
    }
    
    private togglePlayPause(): void {
        if (this.timeController.getIsPlaying()) {
            this.timeController.pause();
        } else {
            this.timeController.play();
        }
        this.updateButtonState();
    }
    
    private updateButtonState(): void {
        if (this.timeController.getIsPlaying()) {
            this.playPauseButton.innerHTML = '⏸';
            this.playPauseButton.setAttribute('aria-label', 'Pause');
        } else {
            this.playPauseButton.innerHTML = '▶';
            this.playPauseButton.setAttribute('aria-label', 'Play');
        }
    }
    
    private handleTimeRangeChange(): void {
        let begin = parseFloat(this.beginInput.value);
        const end = parseFloat(this.endInput.value);
        
        // Ensure begin is not less than 0
        begin = Math.max(0, begin);
        
        if (!isNaN(begin) && !isNaN(end) && begin < end) {
            this.timeController.setTimeRange(begin, end);
            // Update input to reflect clamped value
            if (this.beginInput.value !== begin.toString()) {
                this.beginInput.value = begin.toString();
            }
            // Update end input
            this.endInput.value = end.toString();
        } else {
            // Reset to current values if invalid
            const range = this.timeController.getTimeRange();
            this.beginInput.value = range.begin.toString();
            this.endInput.value = range.end.toString();
        }
    }
    
    private handleFPSChange(): void {
        const fps = parseFloat(this.fpsInput.value);
        if (!isNaN(fps) && fps > 0) {
            this.timeController.setFPS(Math.max(1, Math.min(120, fps)));
            // Update input to reflect clamped value
            if (this.fpsInput.value !== fps.toString()) {
                this.fpsInput.value = fps.toString();
            }
        } else {
            // Reset to current value if invalid
            this.fpsInput.value = this.timeController.getFPS().toString();
        }
    }
    
    private handleCurrentFrameChange(): void {
        const frame = parseFloat(this.currentFrameInput.value);
        if (!isNaN(frame) && frame >= 0) {
            // Set time without clamping to range (allow previewing beyond end)
            const roundedFrame = Math.round(frame);
            this.timeController.setCurrentTimeUnclamped(roundedFrame);
            // Update stored value
            this.lastCurrentFrameValue = roundedFrame.toString();
            // Update pointer position to reflect the change
            this.updatePointerPosition();
        } else {
            // Reset to current value if invalid
            const currentTime = this.timeController.getCurrentTime();
            const resetValue = Math.round(currentTime).toString();
            this.currentFrameInput.value = resetValue;
            this.lastCurrentFrameValue = resetValue;
        }
    }
    
    public getElement(): HTMLElement {
        return this.element;
    }
    
    public dispose(): void {
        // Clean up number labels
        for (const labelElement of this.numberLabels.values()) {
            labelElement.remove();
        }
        this.numberLabels.clear();
        
        if (this.inputManager) {
            this.inputManager.dispose();
            this.inputManager = null;
        }
        if (this.inputContext) {
            this.inputContext.dispose();
            this.inputContext = null;
        }
        if (this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}

