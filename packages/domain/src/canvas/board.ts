// Creative Canvas — board & entitlement contracts.
//
// Zero-dependency rule: this file MUST NOT import from any peer package,
// axios, react, or a rendering engine. Only in-package canvas siblings
// may be imported. The backend stores a canonical board state; presigned
// URLs are never persisted here (see `resolvedCoverImageUrl`).

export type CanvasBoardVisibility = 'private' | 'shared' | 'public';
export type CanvasBoardStatus = 'active' | 'archived' | 'deleted';

/** A user's creative workspace. */
export interface CanvasBoard {
  id: string;
  userId: string;
  title: string;
  description?: string | null;
  /** Stable storage key for the cover; never a presigned URL. */
  coverStorageKey?: string | null;
  /** Hydrated by GET endpoints only. Never persisted as canonical truth. */
  resolvedCoverImageUrl?: string | null;
  visibility: CanvasBoardVisibility;
  status: CanvasBoardStatus;
  /** Optimistic-concurrency token; bumped on every successful save/merge. */
  revision: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * User-level membership entitlement. NOT attached to a single board — the
 * list/detail/state endpoints return it as a sibling of the board payload
 * so the client can degrade the UI without an extra request.
 */
export interface CanvasEntitlement {
  canView: boolean;
  canEditLayout: boolean;
  canSave: boolean;
  canCreateBoard: boolean;
  canGenerate: boolean;
  canUploadMaterial: boolean;
  canPublish: boolean;
  reason?: string | null;
  levelName?: string | null;
  expiresAt?: string | null;
}

/** Everything a non-member/expired user is still allowed to do. */
export const CANVAS_FREE_TIER_ENTITLEMENT: CanvasEntitlement = {
  canView: true,
  canEditLayout: true,
  canSave: true,
  canCreateBoard: false,
  canGenerate: false,
  canUploadMaterial: false,
  canPublish: false,
};
