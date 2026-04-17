import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Tree } from 'react-arborist';
import { NodeApi } from 'react-arborist';
import { useWorld } from './ViewportPanel';
import { SceneNode, PaleObject } from '@paleengine/core';
import './HierarchyPanel.css';

interface TreeNode {
    id: string;
    name: string;
    paleObject?: PaleObject;
    children?: TreeNode[];
}

function convertToTreeData(nodes: SceneNode[]): TreeNode[] {
    return nodes.map((node) => ({
        id: String(node.object.id),
        name: node.object.name,
        paleObject: node.object,
        children: node.children.length > 0 ? convertToTreeData(node.children) : undefined,
    }));
}

export const HierarchyPanel: React.FC = () => {
    const world = useWorld();
    const containerRef = useRef<HTMLDivElement>(null);
    const [treeData, setTreeData] = useState<TreeNode[]>([]);
    const [dimensions, setDimensions] = useState({ width: 250, height: 400 });
    const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

    useEffect(() => {
        if (!world) return;

        const buildTree = (): TreeNode[] => {
            const scene = world.paleScene;
            const rootNodes = scene.getRootNodes();
            return convertToTreeData(rootNodes);
        };

        setTreeData(buildTree());

        const handleChange = () => {
            setTreeData(buildTree());
        };

        world.on('hierarchychange', handleChange);

        return () => {
            world.off('hierarchychange', handleChange);
        };
    }, [world]);

    useEffect(() => {
        if (!world) return;

        const handleSelectionChange = () => {
            const selected = world.selectedObjects;
            const firstSelected = selected.values().next().value;
            setSelectedId(firstSelected ? String(firstSelected.id) : undefined);
        };

        world.on('selectionchange', handleSelectionChange);

        return () => {
            world.off('selectionchange', handleSelectionChange);
        };
    }, [world]);

    useEffect(() => {
        if (!containerRef.current) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                setDimensions({ width, height: Math.max(height - 40, 0) });
            }
        });

        observer.observe(containerRef.current);

        return () => {
            observer.disconnect();
        };
    }, []);

    const handleSelect = useCallback((nodes: NodeApi<TreeNode>[]) => {
        if (!world) return;
        const node = nodes[0];
        if (!node?.data?.paleObject) {
            return;
        }
        world.selectObject(node.data.paleObject);
    }, [world]);

    return (
        <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#1a1a1a', color: '#fff' }}>
            <div style={{ padding: '8px', borderBottom: '1px solid #333', color: '#888', fontSize: '12px', flexShrink: 0 }}>
                Scene Hierarchy ({treeData.length} root objects)
            </div>
            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                {treeData.length > 0 ? (
                    <Tree
                        initialData={treeData}
                        openByDefault={true}
                        width={dimensions.width}
                        height={dimensions.height}
                        className="hierarchy-tree"
                        selection={selectedId}
                        onSelect={handleSelect}
                    >
                        {({ node, style, dragHandle }) => (
                            <div
                                style={{
                                    ...style,
                                    padding: '4px 8px',
                                    cursor: 'pointer',
                                    backgroundColor: node.isSelected ? '#0a4a8a' : 'transparent',
                                }}
                                ref={dragHandle}
                            >
                                <span style={{ marginRight: '4px' }}>
                                    {node.isLeaf ? '🍁' : node.isOpen ? '📂' : '📁'}
                                </span>
                                {node.data.name}
                            </div>
                        )}
                    </Tree>
                ) : (
                    <div style={{ padding: '16px', color: '#666', textAlign: 'center' }}>
                        No objects in scene
                    </div>
                )}
            </div>
        </div>
    );
};