// Engine adapter contract. The business layer talks to this interface only;
// the concrete engine (built-in DOM engine now, tldraw later) is swappable
// without touching the store, SDK, or domain contracts.

import type { ReactNode } from 'react';
import type { CanvasNode, CanvasViewport } from '@autix/domain';

export interface CanvasEngineProps {
  nodes: CanvasNode[];
  selectedNodeIds: string[];
  viewport?: CanvasViewport;
  readOnly?: boolean;
  onSelectionChange: (ids: string[]) => void;
  onNodeMove: (id: string, x: number, y: number) => void;
  onViewportChange?: (viewport: CanvasViewport) => void;
  renderNode: (node: CanvasNode, selected: boolean) => ReactNode;
}

export type CanvasEngineComponent = (props: CanvasEngineProps) => ReactNode;
