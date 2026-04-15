// Author: Fyrestar https://mevedia.com (https://github.com/Fyrestar/THREE.InfiniteGridHelper)

import {
    Mesh,
    PlaneGeometry,
    Color,
    DoubleSide,
    MeshBasicNodeMaterial
} from 'three/webgpu';
import {
    uniform,
    vec2,
    vec3,
    vec4,
    positionLocal,
    positionWorld,
    cameraPosition,
    cameraViewMatrix,
    length,
    pow,
    mix,
    abs,
    fract,
    fwidth,
    min,
    sub,
    mul,
    div,
    add,
    round,
    step
} from 'three/tsl';

export interface InfiniteGridHelperConfig {
    size1?: number;
    size2?: number;
    color?: Color | string | number;
    distance?: number;
    axes?: string;
}

export class InfiniteGridHelper extends Mesh {
    private uSizeFine: ReturnType<typeof uniform>;
    private uSizeCoarse: ReturnType<typeof uniform>;
    private uColor: ReturnType<typeof uniform>;
    private uDistance: ReturnType<typeof uniform>;

    constructor(
        sizeFine: number = 0.1,
        sizeCoarse: number = 1,
        color: Color | string | number = 'black',
        distance: number,
    ) {
        const baseGridColor = color instanceof Color ? color : new Color(color);

        const geometry = new PlaneGeometry(2, 2, 1, 1);

        // 创建 uniform
        const uSizeFine = uniform(sizeFine);
        const uSizeCoarse = uniform(sizeCoarse);
        const uColor = uniform(baseGridColor);
        const uDistance = uniform(distance);

        // 顶点着色器逻辑
        const pos = positionLocal;
        const camPos = cameraPosition;

        // 片段着色器逻辑
        const worldX = positionWorld.x;
        const worldZ = positionWorld.z;
        // 分别计算 X 和 Z 方向的网格坐标
        const rxFine = div(worldX, uSizeFine);
        const rzFine = div(worldZ, uSizeFine);
        const rxCoarse = div(worldX, uSizeCoarse);
        const rzCoarse = div(worldZ, uSizeCoarse);
        
        // 计算小网格线
        const gridXFine = div(abs(sub(fract(sub(rxFine, 0.5)), 0.5)), fwidth(rxFine));
        const gridZFine = div(abs(sub(fract(sub(rzFine, 0.5)), 0.5)), fwidth(rzFine));
        const line1 = min(min(gridXFine, gridZFine), 1.0);
        const g1 = sub(1.0, line1);
        
        // 计算大网格线
        const gridXCoarse = div(abs(sub(fract(sub(rxCoarse, 0.5)), 0.5)), fwidth(rxCoarse));
        const gridZCoarse = div(abs(sub(fract(sub(rzCoarse, 0.5)), 0.5)), fwidth(rzCoarse));
        const line2 = min(min(gridXCoarse, gridZCoarse), 1.0);
        const g2 = sub(1.0, line2);

        // 计算距离衰减（避免摩尔纹）
        const dist = length(vec2(sub(worldX, camPos.x), sub(worldZ, camPos.z)));
        
        // Fine 网格：衰减更快（距离更短，幂次更高）
        const fineFadeDistance = mul(uDistance, 0.01);  // 衰减距离减半
        const fineFadePower = 8.0;  // 幂次更高，衰减更陡峭
        const fineNormalizedDist = div(dist, fineFadeDistance);
        const fineFade = sub(1.0, min(fineNormalizedDist, 1.0));
        const fineFadeAlpha = pow(fineFade, fineFadePower);
        
        // Coarse 网格：衰减较慢
        const coarseFadeDistance = mul(uDistance, 0.02);
        const coarseFadePower = 8.0;
        const coarseNormalizedDist = div(dist, coarseFadeDistance);
        const coarseFade = sub(1.0, min(coarseNormalizedDist, 1.0));
        const coarseFadeAlpha = pow(coarseFade, coarseFadePower);

        // 找到相机视线与 y=0 平面的交点
        // 相机视图矩阵的第三列（反向）是相机朝向
        const viewMatrix = cameraViewMatrix;
        // 提取相机朝向（视图矩阵的 Z 轴，指向相机前方）
        const camDirX = sub(0, viewMatrix[0][2]);
        const camDirY = sub(0, viewMatrix[1][2]);
        const camDirZ = sub(0, viewMatrix[2][2]);
        
        // 计算视线与 y=0 平面的交点
        // ray: camPos + t * camDir, 求 y=0 时的 t
        // camPos.y + t * camDir.y = 0
        // t = -camPos.y / camDir.y
        const t = div(sub(0, camPos.y), camDirY);
        
        // 交点坐标
        const intersectX = add(camPos.x, mul(t, camDirX));
        const intersectZ = add(camPos.z, mul(t, camDirZ));
        
        // 将交点对齐到 coarse grid
        const nearestX = mul(round(div(intersectX, uSizeCoarse)), uSizeCoarse);
        const nearestZ = mul(round(div(intersectZ, uSizeCoarse)), uSizeCoarse);
        
        // 判断当前像素是否在最近的 X 或 Z grid 线上
        // step(edge, x) = x >= edge ? 1.0 : 0.0
        const threshold = mul(uSizeCoarse, 0.05);
        const isNearX = step(abs(sub(worldX, nearestX)), threshold);
        const isNearZ = step(abs(sub(worldZ, nearestZ)), threshold);
        
        // 基础网格颜色 - 将 uColor 转换为 vec3
        const baseColor = vec3(uColor);
        const redColor = vec3(1.0, 0.0, 0.0);   // X 方向红色
        const blueColor = vec3(0.0, 0.0, 1.0);  // Z 方向蓝色
        
        // 混合颜色：只在最近的 coarse grid 线上显示红/蓝色
        // 使用 g2（coarse 网格强度）确保 fine 网格不会被染色
        const useRed = mul(isNearX, g2);
        const useBlue = mul(isNearZ, g2);
        
        let finalColor = baseColor;
        finalColor = mix(finalColor, redColor, useRed);
        finalColor = mix(finalColor, blueColor, useBlue);

        // 最终颜色计算（带距离衰减）
        // g1 (fine) 使用 fineFadeAlpha，g2 (coarse) 使用 coarseFadeAlpha
        const g1Faded = mul(g1, fineFadeAlpha);
        const g2Faded = mul(g2, coarseFadeAlpha);
        const alpha = mix(g2Faded, g1Faded, g1Faded);
        const gridAlpha = mix(mul(0.5, alpha), alpha, g2Faded);
        const finalAlpha = gridAlpha;

        // 创建材质
        // 调试时可以把 colorNode 换成 debugColor 来观察坐标
        const material = new MeshBasicNodeMaterial({
            side: DoubleSide,
            transparent: true,
            colorNode: vec4(finalColor, finalAlpha)
        });

        // 设置顶点位置
        let vertexPos = vec3(
            add(mul(pos.x, uDistance), camPos.x),
            0,
            add(mul(pos.y, uDistance), camPos.z)
        );
        material.positionNode = vertexPos;

        super(geometry, material);

        this.uSizeFine = uSizeFine;
        this.uSizeCoarse = uSizeCoarse;
        this.uColor = uColor;
        this.uDistance = uDistance;
        this.frustumCulled = false;
    }

    /**
     * 更新网格大小
     */
    public setSizes(size1: number, size2: number): void {
        this.uSizeFine.value = size1;
        this.uSizeCoarse.value = size2;
    }

    /**
     * 更新网格颜色
     */
    public setColor(color: Color | string | number): void {
        const finalColor = color instanceof Color ? color : new Color(color);
        this.uColor.value = finalColor;
    }

    /**
     * 更新渲染距离
     */
    public setDistance(distance: number): void {
        this.uDistance.value = distance;
    }
}
