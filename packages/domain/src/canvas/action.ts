// Creative Canvas — action & cost-estimate contracts.
//
// Canvas actions track generation/optimize/export/agent operations triggered
// from the board. Billing (hold/confirm/refund) is owned by the underlying
// flow service — the canvas layer only records the estimate and the related
// hold/task ids.

export type CanvasActionType =
  | 'image-generate'
  | 'image-edit'
  | 'video-from-selection'
  | 'storyboard-from-selection'
  | 'agent-chat'
  | 'export';

export type CanvasActionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'refunded';

/** Action types that actually invoke a model and are therefore billable. */
export const BILLABLE_ACTION_TYPES: ReadonlySet<CanvasActionType> = new Set([
  'image-generate',
  'image-edit',
  'video-from-selection',
  'storyboard-from-selection',
  'agent-chat',
]);

export function isBillableAction(type: CanvasActionType): boolean {
  return BILLABLE_ACTION_TYPES.has(type);
}

/**
 * Dry-run cost preview. `exact` for pricing-rule-backed image/video;
 * `range`/`metered` for open-ended agent-chat whose token cost is unknown
 * up front. A range is never a billing promise.
 */
export type CanvasActionEstimate =
  | { kind: 'exact'; cost: number; currency?: string }
  | { kind: 'range'; minCost: number; maxCost: number; note?: string }
  | { kind: 'metered'; note?: string };

export interface CanvasAction {
  id: string;
  boardId: string;
  userId: string;
  actionType: CanvasActionType;
  status: CanvasActionStatus;
  idempotencyKey?: string | null;
  inputNodeIds?: string[] | null;
  outputNodeIds?: string[] | null;
  placeholderNodeIds?: string[] | null;
  estimatedCost?: number | null;
  relatedHoldId?: string | null;
  relatedTaskId?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Maps an optimistic client placeholder to the server-assigned result node.
 * Returned when an action completes so the client can replace precisely.
 */
export interface CanvasPlaceholderMapping {
  clientPlaceholderId: string;
  resultNodeId: string;
  replaceNodeId: string;
}
