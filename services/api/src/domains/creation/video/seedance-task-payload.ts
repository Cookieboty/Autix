export type SeedanceTaskPayload = Record<string, unknown>;

function getContentObject(payload: SeedanceTaskPayload): Record<string, unknown> | undefined {
  const content = payload.content;
  if (!content || typeof content !== 'object' || Array.isArray(content)) return undefined;
  return content as Record<string, unknown>;
}

function getStringField(
  payload: SeedanceTaskPayload,
  topLevelKey: string,
  contentKey: string,
): string | undefined {
  const topLevelValue = payload[topLevelKey];
  if (typeof topLevelValue === 'string') return topLevelValue;

  const contentValue = getContentObject(payload)?.[contentKey];
  return typeof contentValue === 'string' ? contentValue : undefined;
}

export function getSeedanceStatus(payload: SeedanceTaskPayload): string | undefined {
  const status = payload.status;
  return typeof status === 'string' ? status : undefined;
}

export function getSeedanceVideoUrl(payload: SeedanceTaskPayload): string | undefined {
  return getStringField(payload, 'video_url', 'video_url');
}

export function getSeedanceLastFrameUrl(payload: SeedanceTaskPayload): string | undefined {
  return getStringField(payload, 'last_frame_url', 'last_frame_url');
}

export function getSeedanceErrorMessage(
  payload: SeedanceTaskPayload,
  fallback: string,
): string {
  const error = payload.error;
  if (error && typeof error === 'object' && !Array.isArray(error)) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return fallback;
}

export function getSeedanceDuration(payload: SeedanceTaskPayload): number | null {
  return (payload.duration as number | undefined) ?? null;
}
