'use client';

// Built-in DOM canvas engine: an absolute-positioned, pannable/zoomable
// surface implementing CanvasEngineAdapter. Deliberately dependency-free so
// the app runs before the tldraw license decision; swap behind the adapter.

import { useCallback, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
import type { CanvasViewport } from '@autix/domain';
import type { CanvasEngineProps } from './CanvasEngineAdapter';

interface DragState {
  kind: 'pan' | 'node';
  nodeId?: string;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
}

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3;

export function DomCanvasEngine(props: CanvasEngineProps) {
  const { nodes, selectedNodeIds, readOnly, onSelectionChange, onNodeMove, onViewportChange, renderNode } = props;
  const [viewport, setViewport] = useState<CanvasViewport>(
    props.viewport ?? { x: 0, y: 0, zoom: 1 },
  );
  const dragRef = useRef<DragState | null>(null);

  const selected = new Set(selectedNodeIds);

  const commitViewport = useCallback(
    (next: CanvasViewport) => {
      setViewport(next);
      onViewportChange?.(next);
    },
    [onViewportChange],
  );

  const onBackgroundPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      onSelectionChange([]);
      dragRef.current = {
        kind: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        originX: viewport.x,
        originY: viewport.y,
      };
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    },
    [onSelectionChange, viewport.x, viewport.y],
  );

  const onNodePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>, nodeId: string, nodeX: number, nodeY: number) => {
      e.stopPropagation();
      if (e.button !== 0) return;
      onSelectionChange([nodeId]);
      if (readOnly) return;
      dragRef.current = {
        kind: 'node',
        nodeId,
        startX: e.clientX,
        startY: e.clientY,
        originX: nodeX,
        originY: nodeY,
      };
      (e.currentTarget.parentElement as HTMLDivElement | null)?.setPointerCapture?.(e.pointerId);
    },
    [onSelectionChange, readOnly],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (drag.kind === 'pan') {
        commitViewport({ ...viewport, x: drag.originX + dx, y: drag.originY + dy });
      } else if (drag.kind === 'node' && drag.nodeId) {
        onNodeMove(drag.nodeId, drag.originX + dx / viewport.zoom, drag.originY + dy / viewport.zoom);
      }
    },
    [commitViewport, onNodeMove, viewport],
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const onWheel = useCallback(
    (e: ReactWheelEvent<HTMLDivElement>) => {
      if (!e.ctrlKey && !e.metaKey) return;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, viewport.zoom * factor));
      commitViewport({ ...viewport, zoom });
    },
    [commitViewport, viewport],
  );

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-neutral-50 dark:bg-neutral-900"
      style={{ touchAction: 'none' }}
      onPointerDown={onBackgroundPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onWheel={onWheel}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {nodes.map((node) => (
          <div
            key={node.id}
            onPointerDown={(e) => onNodePointerDown(e, node.id, node.x, node.y)}
            style={{
              position: 'absolute',
              left: node.x,
              top: node.y,
              width: node.width,
              height: node.height,
              outline: selected.has(node.id) ? '2px solid #6366f1' : 'none',
              borderRadius: 8,
            }}
          >
            {renderNode(node, selected.has(node.id))}
          </div>
        ))}
      </div>
    </div>
  );
}
