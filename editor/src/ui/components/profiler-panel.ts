import { Panel } from '../window/window';
import { LineChart, LineChartData } from './chart';
import { PerformanceMonitor } from '../../engine/profiler';

export class ProfilerPanel extends Panel {
    private performanceMonitor: PerformanceMonitor;
    private fpsChart: LineChart | null = null;
    private memoryChart: LineChart | null = null;
    private statsContainer: HTMLElement | null = null;
    private isUpdating: boolean = false;
    private updateId: number | null = null;
    private isMounted: boolean = false;
    
    constructor(performanceMonitor: PerformanceMonitor) {
        super('Profiler');
        this.setDefaultFloatingSize({ width: 440, height: 360 });
        this.performanceMonitor = performanceMonitor;
    }
    
    protected override onMount(_container: HTMLElement): void {
        if (this.isMounted) {
            return;
        }
        this.isMounted = true;
        this.renderContent();
        this.isUpdating = true;
        this.startUpdate();
    }

    protected override onUnmount(): void {
        if (!this.isMounted) {
            return;
        }
        this.isMounted = false;
        this.stopUpdate();
        this.isUpdating = false;
        this.disposeCharts();
        this.statsContainer = null;
        const element = this.getElement();
        element.classList.remove('profiler-panel-content');
        element.innerHTML = '';
    }

    private renderContent(): void {
        const content = this.getElement();
        content.classList.add('profiler-panel-content');
        content.innerHTML = '';
        this.disposeCharts();
        this.statsContainer = null;
        
        const fpsContainer = this.createChartContainer('FPS');
        const fpsCanvasContainer = document.createElement('div');
        fpsCanvasContainer.className = 'chart-container';
        fpsContainer.appendChild(fpsCanvasContainer);
        
        this.fpsChart = new LineChart(fpsCanvasContainer, {
            width: 380,
            height: 100,
            lineColor: '#4CAF50',
            label: 'FPS'
        });
        content.appendChild(fpsContainer);
        
        const memoryContainer = this.createChartContainer('MEM Usage');
        const memoryCanvasContainer = document.createElement('div');
        memoryCanvasContainer.className = 'chart-container';
        memoryContainer.appendChild(memoryCanvasContainer);
        
        this.memoryChart = new LineChart(memoryCanvasContainer, {
            width: 380,
            height: 100,
            lineColor: '#2196F3',
            label: 'Memory'
        });
        content.appendChild(memoryContainer);
        
        this.statsContainer = document.createElement('div');
        this.statsContainer.className = 'profiler-stats';
        content.appendChild(this.statsContainer);
        
        const controls = document.createElement('div');
        controls.className = 'profiler-controls';
        
        const clearButton = document.createElement('button');
        clearButton.className = 'profiler-button';
        clearButton.textContent = 'Clear';
        clearButton.addEventListener('click', () => {
            this.performanceMonitor.clear();
            this.updateCharts();
        });
        
        const pauseButton = document.createElement('button');
        pauseButton.className = 'profiler-button';
        pauseButton.textContent = 'Pause';
        pauseButton.addEventListener('click', () => {
            this.togglePause();
            pauseButton.textContent = this.isUpdating ? 'Pause' : 'Continue';
        });
        
        controls.appendChild(clearButton);
        controls.appendChild(pauseButton);
        content.appendChild(controls);
        
        this.updateCharts();
    }
    
    private createChartContainer(title: string): HTMLElement {
        const container = document.createElement('div');
        container.className = 'chart-wrapper';
        
        const header = document.createElement('div');
        header.className = 'chart-header';
        header.textContent = title;
        
        container.appendChild(header);
        return container;
    }
    
    private updateCharts(): void {
        if (!this.fpsChart) {
            return;
        }
        const data = this.performanceMonitor.getData();
        const stats = this.performanceMonitor.getStatistics();
        
        const fpsData: LineChartData[] = data.map(d => ({
            timestamp: d.timestamp,
            value: d.fps
        }));
        
        const memoryData: LineChartData[] = data
            .filter(d => d.memory > 0)
            .map(d => ({
                timestamp: d.timestamp,
                value: d.memory / 1024 / 1024
            }));
        
        this.fpsChart.updateData(fpsData);
        this.fpsChart.autoFitYRange(0.1);
        
        if (memoryData.length > 0 && this.memoryChart) {
            this.memoryChart.updateData(memoryData);
            this.memoryChart.autoFitYRange(0.1);
        }
        
        this.updateStats(stats);
    }
    
    private updateStats(stats: ReturnType<typeof this.performanceMonitor.getStatistics>): void {
        const container = this.statsContainer;
        if (!container) {
            return;
        }
        container.innerHTML = '';
        
        if (!stats.current) {
            return;
        }
        
        const statRows = [
            ['FPS', `${stats.current.fps.toFixed(1)}`, `Avg.: ${stats.avgFps.toFixed(1)}`, `Range: ${stats.minFps.toFixed(1)} - ${stats.maxFps.toFixed(1)}`],
        ];
        
        if (this.performanceMonitor.isMemoryMonitoringAvailable() && stats.current.memory > 0) {
            statRows.push([
                'MEM',
                `${(stats.current.memory / 1024 / 1024).toFixed(2)} MB`,
                `Avg.: ${(stats.avgMemory / 1024 / 1024).toFixed(2)} MB`,
                `Range: ${(stats.minMemory / 1024 / 1024).toFixed(2)} - ${(stats.maxMemory / 1024 / 1024).toFixed(2)} MB`
            ]);
        } else {
            const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
            statRows.push([
                'MEM',
                'N/A',
                isFirefox ? 'Firefox needs configuration.' : 'Chrome/Edge only.',
                ''
            ]);
        }
        
        statRows.forEach(row => {
            const rowElement = document.createElement('div');
            rowElement.className = 'stat-row';
            
            row.forEach((cell, index) => {
                const cellElement = document.createElement('span');
                cellElement.className = index === 0 ? 'stat-label' : 
                                       index === 1 ? 'stat-current' : 'stat-value';
                cellElement.textContent = cell;
                rowElement.appendChild(cellElement);
            });
            
            container.appendChild(rowElement);
        });
    }
    
    private togglePause(): void {
        this.isUpdating = !this.isUpdating;
        
        if (this.isUpdating) {
            this.startUpdate();
        } else {
            this.stopUpdate();
        }
    }
    
    private startUpdate(): void {
        if (!this.isUpdating || this.updateId !== null || !this.isMounted) {
            return;
        }
        
        const update = () => {
            this.updateCharts();
            
            if (this.isUpdating) {
                this.updateId = requestAnimationFrame(update);
            }
        };
        
        this.updateId = requestAnimationFrame(update);
    }
    
    private stopUpdate(): void {
        if (this.updateId !== null) {
            cancelAnimationFrame(this.updateId);
            this.updateId = null;
        }
    }

    private disposeCharts(): void {
        if (this.fpsChart) {
            this.fpsChart.dispose();
            this.fpsChart = null;
        }
        if (this.memoryChart) {
            this.memoryChart.dispose();
            this.memoryChart = null;
        }
    }
    
    public dispose(): void {
        this.stopUpdate();
        this.disposeCharts();
        this.statsContainer = null;
        super.dispose();
    }
}

