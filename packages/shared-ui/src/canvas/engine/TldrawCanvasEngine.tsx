'use client';

// tldraw-backed canvas engine implementing CanvasEngineAdapter.
// Our domain nodes are hosted as a single custom shape type ('canvas-node')
// whose React body renders the business node cards. Domain <-> tldraw sync is
// echo-safe: programmatic writes go through store.mergeRemoteChanges (source
// 'remote') and the change listener only reacts to source 'user'.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import {
  BaseBoxShapeUtil,
  HTMLContainer,
  T,
  Tldraw,
  createShapeId,
  type Editor,
  type TLBaseShape,
} from 'tldraw';
import 'tldraw/tldraw.css';
import type { CanvasNode } from '@autix/domain';
import type { CanvasEngineProps } from './CanvasEngineAdapter';

interface CanvasNodeShapeProps {
  w: number;
  h: number;
  nodeId: string;
}
type CanvasNodeShape = TLBaseShape<'canvas-node', CanvasNodeShapeProps>;

// Register the custom shape into tldraw's global type map so `TLShape`,
// `getShape`, `createShapes`, etc. are strongly typed for 'canvas-node'.
declare module 'tldraw' {
  interface TLGlobalShapePropsMap {
    'canvas-node': CanvasNodeShapeProps;
  }
}

const NodesContext = createContext<Map<string, CanvasNode>>(new Map());
const RenderContext = createContext<(node: CanvasNode, selected: boolean) => ReactNode>(() => null);

function CanvasNodeShapeBody({ shape }: { shape: CanvasNodeShape }) {
  const nodes = useContext(NodesContext);
  const render = useContext(RenderContext);
  const node = nodes.get(shape.props.nodeId);
  return (
    <HTMLContainer style={{ width: shape.props.w, height: shape.props.h, pointerEvents: 'all' }}>
      {node ? render(node, false) : null}
    </HTMLContainer>
  );
}

class CanvasNodeShapeUtil extends BaseBoxShapeUtil<CanvasNodeShape> {
  static override type = 'canvas-node' as const;
  static override props = { w: T.number, h: T.number, nodeId: T.string };

  override getDefaultProps(): CanvasNodeShape['props'] {
    return { w: 320, h: 320, nodeId: '' };
  }

  override canResize(): boolean {
    return false;
  }

  override component(shape: CanvasNodeShape) {
    return <CanvasNodeShapeBody shape={shape} />;
  }

  override getIndicatorPath(shape: CanvasNodeShape) {
    const path = new Path2D();
    path.rect(0, 0, shape.props.w, shape.props.h);
    return path;
  }
}

const SHAPE_UTILS = [CanvasNodeShapeUtil];

export function TldrawCanvasEngine(props: CanvasEngineProps) {
  const { nodes, selectedNodeIds, readOnly, onSelectionChange, onNodeMove, renderNode } = props;
  const nodesMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const editorRef = useRef<Editor | null>(null);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  // Reconcile domain nodes into tldraw shapes (echo-safe: source 'remote').
  const reconcile = useCallback((editor: Editor) => {
    editor.store.mergeRemoteChanges(() => {
      const wanted = new Set<string>();
      for (const node of nodesRef.current) {
        const id = createShapeId(node.id);
        wanted.add(id);
        const existing = editor.getShape(id);
        const partial = {
          id,
          type: 'canvas-node' as const,
          x: node.x,
          y: node.y,
          props: { w: node.width, h: node.height, nodeId: node.id },
        };
        if (existing) editor.updateShapes([partial]);
        else editor.createShapes([partial]);
      }
      const stale = editor
        .getCurrentPageShapes()
        .filter((s) => s.type === 'canvas-node' && !wanted.has(s.id))
        .map((s) => s.id);
      if (stale.length > 0) editor.deleteShapes(stale);
    });
  }, []);

  const onMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      if (readOnly) editor.updateInstanceState({ isReadonly: true });
      reconcile(editor);

      // React only to user edits; programmatic reconciles are 'remote'.
      const unlisten = editor.store.listen(
        () => {
          const nodeById = new Map(nodesRef.current.map((n) => [n.id, n]));
          const shapes = editor
            .getCurrentPageShapes()
            .filter((s): s is CanvasNodeShape => s.type === 'canvas-node');

          for (const shape of shapes) {
            const node = nodeById.get(shape.props.nodeId);
            if (node && (Math.abs(node.x - shape.x) > 0.5 || Math.abs(node.y - shape.y) > 0.5)) {
              onNodeMove(shape.props.nodeId, shape.x, shape.y);
            }
          }

          const selectedNodeIdsNext = editor
            .getSelectedShapeIds()
            .map((id) => editor.getShape<CanvasNodeShape>(id)?.props.nodeId)
            .filter((v): v is string => Boolean(v));
          onSelectionChange(selectedNodeIdsNext);
        },
        { source: 'user', scope: 'document' },
      );

      return () => unlisten();
    },
    [onNodeMove, onSelectionChange, reconcile, readOnly],
  );

  // Re-reconcile whenever domain nodes change (e.g. generated results merged in).
  useEffect(() => {
    if (editorRef.current) reconcile(editorRef.current);
  }, [nodes, reconcile]);

  // Reflect external selection changes into tldraw.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.store.mergeRemoteChanges(() => {
      editor.setSelectedShapes(selectedNodeIds.map((nodeId) => createShapeId(nodeId)));
    });
  }, [selectedNodeIds]);

  return (
    <NodesContext.Provider value={nodesMap}>
      <RenderContext.Provider value={renderNode}>
        <div className="h-full w-full">
          <Tldraw shapeUtils={SHAPE_UTILS} onMount={onMount} />
        </div>
      </RenderContext.Provider>
    </NodesContext.Provider>
  );
}
