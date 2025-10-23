import { PerspectiveCamera, WebGPURenderer } from 'three/webgpu';


export class Resizer {
    private readonly _container: HTMLElement;
    private readonly _camera: PerspectiveCamera;
    private readonly _renderer: WebGPURenderer;

    public constructor(
        container: HTMLElement,
        camera: PerspectiveCamera,
        renderer: WebGPURenderer
    ) {
        this._container = container;
        this._camera = camera;
        this._renderer = renderer;
        
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