export interface LineChartData {
    value: number;
    timestamp: number;
}

export interface LineChartOptions {
    width?: number;
    height?: number;
    minValue?: number;
    maxValue?: number;
    lineColor?: string;
    gridColor?: string;
    textColor?: string;
    backgroundColor?: string;
    label?: string;
    timeWindowMs?: number;
}

export class LineChart {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private data: LineChartData[] = [];
    private options: Required<LineChartOptions>;
    
    constructor(container: HTMLElement, options: LineChartOptions = {}) {
        this.options = {
            width: options.width ?? 400,
            height: options.height ?? 150,
            minValue: options.minValue ?? 0,
            maxValue: options.maxValue ?? 100,
            lineColor: options.lineColor ?? '#4CAF50',
            gridColor: options.gridColor ?? 'rgba(0, 0, 0, 0.1)',
            textColor: options.textColor ?? '#666',
            backgroundColor: options.backgroundColor ?? '#ffffff',
            label: options.label ?? '',
            timeWindowMs: options.timeWindowMs ?? 30000
        };
        
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.options.width;
        this.canvas.height = this.options.height;
        this.ctx = this.canvas.getContext('2d')!;
        
        container.appendChild(this.canvas);
    }
    
    public updateData(data: LineChartData[]): void {
        this.data = [...data];
        this.draw();
    }
    
    public setYRange(min: number, max: number): void {
        this.options.minValue = min;
        this.options.maxValue = max;
        this.draw();
    }
    
    public autoFitYRange(padding: number = 0.1): void {
        if (this.data.length === 0) return;
        
        const values = this.data.map(d => d.value).filter(v => v >= 0);
        if (values.length === 0) return;
        
        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = max - min;
        const paddingValue = range * padding;
        
        this.options.minValue = Math.max(0, min - paddingValue);
        this.options.maxValue = max + paddingValue;
        this.draw();
    }
    
    private draw(): void {
        const { width, height, backgroundColor } = this.options;
        
        this.ctx.fillStyle = backgroundColor;
        this.ctx.fillRect(0, 0, width, height);
        
        if (this.data.length === 0) {
            this.drawEmptyState();
            return;
        }
        
        this.drawGrid();
        this.drawLine();
        this.drawLabels();
    }
    
    private drawEmptyState(): void {
        const { width, height, textColor } = this.options;
        
        this.ctx.fillStyle = textColor;
        this.ctx.font = '12px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Empty.', width / 2, height / 2);
    }
    
    private drawGrid(): void {
        const { width, height, gridColor, textColor, minValue, maxValue } = this.options;
        
        this.ctx.strokeStyle = gridColor;
        this.ctx.lineWidth = 1;
        
        const horizontalLines = 5;
        for (let i = 0; i <= horizontalLines; i++) {
            const y = (height - 40) * (i / horizontalLines) + 20;
            this.ctx.beginPath();
            this.ctx.moveTo(50, y);
            this.ctx.lineTo(width - 10, y);
            this.ctx.stroke();
            
            const value = maxValue - (maxValue - minValue) * (i / horizontalLines);
            this.ctx.fillStyle = textColor;
            this.ctx.font = '10px sans-serif';
            this.ctx.textAlign = 'right';
            this.ctx.fillText(this.formatValue(value), 45, y + 3);
        }
    }
    
    private drawLine(): void {
        const { width, height, lineColor, minValue, maxValue } = this.options;
        
        if (this.data.length === 0) return;
        
        this.ctx.strokeStyle = lineColor;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        
        const valueRange = maxValue - minValue;
        const startTime = this.data[0].timestamp;
        const endTime = this.data[this.data.length - 1].timestamp;
        const dataTimeSpan = endTime - startTime;
        
        if (dataTimeSpan > this.options.timeWindowMs) {
            const windowStart = endTime - this.options.timeWindowMs;
            let firstPoint = true;
            
            for (let i = 0; i < this.data.length; i++) {
                const point = this.data[i];
                if (point.timestamp < windowStart) continue;
                
                const normalizedTime = (point.timestamp - windowStart) / this.options.timeWindowMs;
                const x = 50 + (width - 60) * normalizedTime;
                const normalizedValue = (point.value - minValue) / valueRange;
                const y = height - 20 - (height - 40) * normalizedValue;
                
                if (firstPoint) {
                    this.ctx.moveTo(x, y);
                    firstPoint = false;
                } else {
                    this.ctx.lineTo(x, y);
                }
            }
        } else {
            for (let i = 0; i < this.data.length; i++) {
                const point = this.data[i];
                const normalizedTime = (point.timestamp - startTime) / dataTimeSpan;
                const x = 50 + (width - 60) * normalizedTime;
                const normalizedValue = (point.value - minValue) / valueRange;
                const y = height - 20 - (height - 40) * normalizedValue;
                
                if (i === 0) {
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }
            }
        }
        
        this.ctx.stroke();
        
        this.ctx.fillStyle = lineColor;
        if (dataTimeSpan > this.options.timeWindowMs) {
            const windowStart = endTime - this.options.timeWindowMs;
            
            for (let i = 0; i < this.data.length; i++) {
                const point = this.data[i];
                if (point.timestamp < windowStart) continue;
                
                const normalizedTime = (point.timestamp - windowStart) / this.options.timeWindowMs;
                const x = 50 + (width - 60) * normalizedTime;
                const normalizedValue = (point.value - minValue) / valueRange;
                const y = height - 20 - (height - 40) * normalizedValue;
                
                this.ctx.beginPath();
                this.ctx.arc(x, y, 2, 0, Math.PI * 2);
                this.ctx.fill();
            }
        } else {
            for (let i = 0; i < this.data.length; i++) {
                const point = this.data[i];
                const normalizedTime = (point.timestamp - startTime) / dataTimeSpan;
                const x = 50 + (width - 60) * normalizedTime;
                const normalizedValue = (point.value - minValue) / valueRange;
                const y = height - 20 - (height - 40) * normalizedValue;
                
                this.ctx.beginPath();
                this.ctx.arc(x, y, 2, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
    }
    
    private drawLabels(): void {
        const { width, height, textColor, label } = this.options;
        
        this.ctx.fillStyle = textColor;
        this.ctx.font = '10px sans-serif';
        this.ctx.textAlign = 'center';
        
        if (this.data.length >= 2) {
            const startTime = this.data[0].timestamp;
            const endTime = this.data[this.data.length - 1].timestamp;
            const dataTimeSpan = endTime - startTime;
            const intervals = 5;
            
            if (dataTimeSpan > this.options.timeWindowMs) {
                const windowStartSeconds = (endTime - this.options.timeWindowMs) / 1000;
                const windowDurationSeconds = this.options.timeWindowMs / 1000;
                
                for (let i = 0; i <= intervals; i++) {
                    const x = 50 + (width - 60) * (i / intervals);
                    const seconds = windowStartSeconds + (windowDurationSeconds * i / intervals);
                    this.ctx.fillText(`${seconds.toFixed(0)}s`, x, height - 5);
                }
            } else {
                for (let i = 0; i <= intervals; i++) {
                    const x = 50 + (width - 60) * (i / intervals);
                    const seconds = (dataTimeSpan * i / intervals) / 1000;
                    this.ctx.fillText(`${seconds.toFixed(0)}s`, x, height - 5);
                }
            }
        }
        
        if (label) {
            this.ctx.save();
            this.ctx.translate(10, height / 2);
            this.ctx.rotate(-Math.PI / 2);
            this.ctx.textAlign = 'center';
            this.ctx.fillStyle = textColor;
            this.ctx.font = '11px sans-serif';
            this.ctx.fillText(label, 0, 0);
            this.ctx.restore();
        }
    }
    
    private formatValue(value: number): string {
        if (value < 1000) {
            return value.toFixed(0);
        } else if (value < 1000000) {
            return (value / 1000).toFixed(1) + 'K';
        } else {
            return (value / 1000000).toFixed(2) + 'M';
        }
    }
    
    public getCanvas(): HTMLCanvasElement {
        return this.canvas;
    }
    
    public dispose(): void {
        if (this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }
}
