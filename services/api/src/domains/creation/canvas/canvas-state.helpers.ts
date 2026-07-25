import { CANVAS_FREE_TIER_ENTITLEMENT, type CanvasEntitlement } from '@autix/domain';

export interface EntitlementInput {
  active: boolean;
  levelName?: string | null;
  expiresAt?: Date | null;
  reason?: string | null;
}

/** Pure builder: map a membership snapshot to a canvas entitlement. */
export function buildCanvasEntitlement(input: EntitlementInput): CanvasEntitlement {
  const expiresAt = input.expiresAt?.toISOString() ?? null;
  if (!input.active) {
    return {
      ...CANVAS_FREE_TIER_ENTITLEMENT,
      reason: input.reason ?? 'This feature requires an active membership',
      levelName: input.levelName ?? null,
      expiresAt,
    };
  }
  return {
    canView: true,
    canEditLayout: true,
    canSave: true,
    canCreateBoard: true,
    canGenerate: true,
    canUploadMaterial: true,
    canPublish: false,
    levelName: input.levelName ?? null,
    expiresAt,
  };
}
