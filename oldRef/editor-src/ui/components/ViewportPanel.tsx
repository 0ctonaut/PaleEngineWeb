import React, { createContext, useContext, useEffect, useRef } from 'react';
import { World } from '../../engine';

const WorldContext = createContext<World | null>(null);
export const useWorld = () => useContext(WorldContext);
export const WorldProvider = WorldContext.Provider;

export const SceneViewportPanel: React.FC = () => {
    const world = useWorld();
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current || !world) return;

        const container = containerRef.current;
        const canvas = world.engine.getRenderingCanvas();

        if (!canvas) return;

        if (canvas.parentNode !== container) {
            container.appendChild(canvas);
        }

        const updateSize = () => {
            const bounds = container.getBoundingClientRect();
            world.updateSize(bounds.width, bounds.height);
        };

        const resizeObserver = new ResizeObserver(updateSize);
        resizeObserver.observe(container);
        updateSize();

        return () => {
            resizeObserver.disconnect();
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
}