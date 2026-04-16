import React, { useEffect, useRef } from 'react';

export interface ViewportPanelProps {
    world: any;
}

export const ViewportPanel: React.FC<ViewportPanelProps> = ({ world }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current || !world) return;

        const container = containerRef.current;
        const canvas = world.getRenderer().domElement;

        canvas.style.width = '100%';
        canvas.style.height = '100%';
        container.appendChild(canvas);

        const updateSize = () => {
            if (!world) return;

            const bounds = container.getBoundingClientRect();
            const renderer = world.getRenderer();
            renderer.setSize(bounds.width, bounds.height);
            renderer.setPixelRatio(window.devicePixelRatio);

            const camera = world.getCamera();
            camera.aspect = bounds.width / bounds.height;
            camera.updateProjectionMatrix();

            const passManager = (world as any).passManager;
            if (passManager) {
                passManager.setSize(bounds.width, bounds.height);
            }
        };

        const resizeObserver = new ResizeObserver(updateSize);
        resizeObserver.observe(container);

        updateSize();

        return () => {
            resizeObserver.disconnect();
            if (canvas.parentNode === container) {
                container.removeChild(canvas);
            }
        };
    }, [world]);

    return (
        <div
            ref={containerRef}
            style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
                backgroundColor: '#1a1a1a'
            }}
        />
    );
};