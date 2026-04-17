import { Mesh, ShaderMaterial, Vector3, Color3, Scene } from 'babylonjs';

const GRID_VERTEX_SHADER = `
    precision highp float;

    attribute vec3 position;

    uniform mat4 worldViewProjection;

    varying vec3 vWorldPos;

    void main() {
        vec4 worldPos = world * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = worldViewProjection * vec4(position, 1.0);
    }
`;

const GRID_FRAGMENT_SHADER = `
    precision highp float;

    varying vec3 vWorldPos;

    uniform float uSizeFine;
    uniform float uSizeCoarse;
    uniform vec3 uColor;
    uniform float uDistance;
    uniform vec3 uCameraPosition;

    void main() {
        float dist = distance(vWorldPos.xz, uCameraPosition.xz);

        float gridXFine = abs(fract(vWorldPos.x / uSizeFine - 0.5) - 0.5) / fwidth(vWorldPos.x / uSizeFine);
        float gridZFine = abs(fract(vWorldPos.z / uSizeFine - 0.5) - 0.5) / fwidth(vWorldPos.z / uSizeFine);
        float line1 = min(min(gridXFine, gridZFine), 1.0);
        float g1 = 1.0 - line1;

        float gridXCoarse = abs(fract(vWorldPos.x / uSizeCoarse - 0.5) - 0.5) / fwidth(vWorldPos.x / uSizeCoarse);
        float gridZCoarse = abs(fract(vWorldPos.z / uSizeCoarse - 0.5) - 0.5) / fwidth(vWorldPos.z / uSizeCoarse);
        float line2 = min(min(gridXCoarse, gridZCoarse), 1.0);
        float g2 = 1.0 - line2;

        float fineFade = 1.0 - min(dist / (uDistance * 0.01), 1.0);
        fineFade = pow(fineFade, 8.0);

        float coarseFade = 1.0 - min(dist / (uDistance * 0.02), 1.0);
        coarseFade = pow(coarseFade, 4.0);

        float alpha = max(g1 * fineFade * 0.5, g2 * coarseFade * 0.8);

        gl_FragColor = vec4(uColor, alpha);
    }
`;

export class InfiniteGridHelper extends Mesh {
    private _gridMaterial: ShaderMaterial;

    constructor(
        scene: Scene,
        sizeFine: number = 0.1,
        sizeCoarse: number = 1,
        color: string | number = 0x444444,
        distance: number = 1000
    ) {
        super('InfiniteGridHelper', scene);

        const colorObj = typeof color === 'string'
            ? Color3.FromHexString(color)
            : new Color3(((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255);

        this._gridMaterial = new ShaderMaterial('GridShader', scene, {
            vertexSource: GRID_VERTEX_SHADER,
            fragmentSource: GRID_FRAGMENT_SHADER
        }, {
            attributes: ['position'],
            uniforms: ['worldViewProjection', 'world', 'uSizeFine', 'uSizeCoarse', 'uColor', 'uDistance', 'uCameraPosition']
        });

        this._gridMaterial.setFloat('uSizeFine', sizeFine);
        this._gridMaterial.setFloat('uSizeCoarse', sizeCoarse);
        this._gridMaterial.setColor3('uColor', colorObj);
        this._gridMaterial.setFloat('uDistance', distance);
        this._gridMaterial.setVector3('uCameraPosition', Vector3.Zero());
        this._gridMaterial.backFaceCulling = false;
        this._gridMaterial.alpha = 0.5;

        this._gridMaterial.onBind = () => {
            this._gridMaterial.setVector3('uCameraPosition', scene.activeCamera?.position || Vector3.Zero());
        };

        this.material = this._gridMaterial;
    }

    public setDistance(distance: number): void {
        this._gridMaterial.setFloat('uDistance', distance);
    }

    public setColor(color: Color3): void {
        this._gridMaterial.setColor3('uColor', color);
    }
}