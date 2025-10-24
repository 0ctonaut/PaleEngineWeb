import { PerspectiveCamera, WebGPURenderer } from 'three/webgpu';


export class Resizer {
    private readonly _container: HTMLElement;
    private readonly _camera: PerspectiveCamera;
    private readonly _renderer: WebGPURenderer;
    private _resizeCallback?: (width: number, height: number) => void;

    public constructor(
        container: HTMLElement,
        camera: PerspectiveCamera,
        renderer: WebGPURenderer,
        resizeCallback?: (width: number, height: number) => void
    ) {
        this._container = container;
        this._camera = camera;
        this._renderer = renderer;
        this._resizeCallback = resizeCallback;
        
        this._updateSize();
        this._setupResizeListener();
    }


    private _updateSize(): void {
        const width = this._container.clientWidth;
        const height = this._container.clientHeight;
        
        if (height === 0) {
            console.warn('Container height is 0, using default aspect ratio');
            return;
        }
        
        this._camera.aspect = width / height;
        this._camera.updateProjectionMatrix();
        
        this._renderer.setSize(width, height);
        this._renderer.setPixelRatio(window.devicePixelRatio);
        
        // 调用 resize 回调
        if (this._resizeCallback) {
            this._resizeCallback(width, height);
        }
    }

    private _setupResizeListener(): void {
        const handleResize = (): void => {
            this._updateSize();
        };
        
        window.addEventListener('resize', handleResize);
        (this as any)._cleanup = () => {
            window.removeEventListener('resize', handleResize);
        };
    }

    public updateSize(): void {
        this._updateSize();
    }

    public dispose(): void {
        if ((this as any)._cleanup) {
            (this as any)._cleanup();
        }
    }
}