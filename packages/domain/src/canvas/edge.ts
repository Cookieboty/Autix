// Creative Canvas — edge contracts.
//
// Edges express creative relationships, not just drawn lines. System edges
// are created by actions and are immutable in the UI; user-drawn edges
// default to `reference` and can be re-typed in the inspector.

export type CanvasEdgeKind =
  | 'reference'
  | 'styleReference'
  | 'generatedFrom'
  | 'variantOf'
  | 'maskOf'
  | 'startFrame'
  | 'endFrame'
  | 'storyboardNext'
  | 'usesMaterial';

export interface CanvasEdge {
  id: string;
  kind: CanvasEdgeKind;
  fromNodeId: string;
  toNodeId: string;
  label?: string;
  metadata?: Record<string, unknown>;
}

/**
 * System-owned edge kinds. Auto-created by actions, rendered with a badge,
 * and not user-editable into a plain line.
 */
export const SYSTEM_EDGE_KINDS: ReadonlySet<CanvasEdgeKind> = new Set([
  'generatedFrom',
  'variantOf',
  'maskOf',
  'startFrame',
  'endFrame',
  'usesMaterial',
]);

/** Edge kinds a user may assign to a hand-drawn connection. */
export const USER_ASSIGNABLE_EDGE_KINDS: ReadonlySet<CanvasEdgeKind> = new Set([
  'reference',
  'styleReference',
  'storyboardNext',
]);

export function isSystemEdge(kind: CanvasEdgeKind): boolean {
  return SYSTEM_EDGE_KINDS.has(kind);
}
