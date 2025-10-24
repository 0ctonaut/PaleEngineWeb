export interface ParameterConfig {
    key: string;
    label: string;
    min: number;
    max: number;
    step: number;
    currentValue: number;
    defaultValue: number;
    precision?: number; // Display precision
    onChange?: (value: number) => void;
    onReset?: (value: number) => void;
}

export class ParameterControl {
    private container: HTMLElement;
    private config: ParameterConfig;
    
    private slider!: HTMLInputElement;
    private input!: HTMLInputElement;
    private resetButton!: HTMLButtonElement;
    
    constructor(config: ParameterConfig) {
        this.config = config;
        this.container = this.createControl();
    }
    
    private createControl(): HTMLElement {
        const group = document.createElement('div');
        group.className = 'param-control';
        
        // Label
        const label = document.createElement('label');
        label.className = 'param-label';
        label.textContent = this.config.label;
        
        // Control area
        const controls = document.createElement('div');
        controls.className = 'param-controls';
        
        // Slider
        this.slider = this.createSlider();
        
        // Number input
        this.input = this.createInput();
        
        // Reset button (shows current value)
        this.resetButton = this.createResetButton();
        
        // Assemble (order: slider → input → reset button)
        controls.appendChild(this.slider);
        controls.appendChild(this.input);
        controls.appendChild(this.resetButton);
        
        group.appendChild(label);
        group.appendChild(controls);
        
        return group;
    }
    
    private createSlider(): HTMLInputElement {
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'param-slider';
        slider.min = this.config.min.toString();
        slider.max = this.config.max.toString();
        slider.step = this.config.step.toString();
        slider.value = this.config.currentValue.toString();
        
        slider.addEventListener('input', () => {
            this.updateValue(parseFloat(slider.value));
        });
        
        return slider;
    }
    
    private createInput(): HTMLInputElement {
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'param-input';
        input.min = this.config.min.toString();
        input.max = this.config.max.toString();
        input.step = this.config.step.toString();
        input.value = this.formatValue(this.config.currentValue);
        
        input.addEventListener('change', () => {
            let value = parseFloat(input.value);
            if (isNaN(value)) {
                value = this.config.defaultValue;
            }
            value = Math.max(this.config.min, Math.min(this.config.max, value));
            this.updateValue(value);
        });
        
        return input;
    }
    
    private createResetButton(): HTMLButtonElement {
        const button = document.createElement('button');
        button.className = 'param-reset-btn';
        button.textContent = this.formatValue(this.config.currentValue);
        button.title = `Click to reset to default: ${this.formatValue(this.config.defaultValue)}`;
        
        button.addEventListener('click', () => {
            this.resetToDefault();
        });
        
        return button;
    }
    
    private formatValue(value: number): string {
        const precision = this.config.precision ?? 3;
        return value.toFixed(precision);
    }
    
    private updateValue(value: number): void {
        this.config.currentValue = value;
        
        // Sync all controls
        this.slider.value = value.toString();
        this.input.value = this.formatValue(value);
        this.resetButton.textContent = this.formatValue(value);
        
        // Trigger callback
        if (this.config.onChange) {
            this.config.onChange(value);
        }
    }
    
    private resetToDefault(): void {
        this.updateValue(this.config.defaultValue);
        
        // Trigger reset callback
        if (this.config.onReset) {
            this.config.onReset(this.config.defaultValue);
        }
    }
    
    public setValue(value: number): void {
        this.updateValue(value);
    }
    
    public getValue(): number {
        return this.config.currentValue;
    }
    
    public getElement(): HTMLElement {
        return this.container;
    }
    
    public dispose(): void {
        // Clean up event listeners (handled automatically by browser)
    }
}
