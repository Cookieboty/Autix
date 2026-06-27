import {
  RATIO_VALUES,
  isVideoWorkspaceMode,
  normalizeVideoDuration,
} from '../video/workbench/constants';

export type ImageWorkbenchDraft = {
  prompt?: string;
  size?: string;
  quality?: string;
  count?: number;
};

export type VideoWorkbenchDraft = {
  prompt?: string;
  duration?: number;
  resolution?: string;
  ratio?: string;
  generateAudio?: boolean;
  mode?: string;
};

function cleanString(raw: string | null): string | undefined {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

export function parseGenerateAudioParam(raw: string | null): boolean | undefined {
  if (raw === '1' || raw === 'true') return true;
  if (raw === '0' || raw === 'false') return false;
  return undefined;
}

export function parseImageDraftQuery(get: (k: string) => string | null): ImageWorkbenchDraft {
  const draft: ImageWorkbenchDraft = {};
  const prompt = cleanString(get('prompt'));
  if (prompt) draft.prompt = prompt;
  const size = cleanString(get('size'));
  if (size) draft.size = size;
  const quality = cleanString(get('quality'));
  if (quality) draft.quality = quality;
  const count = Number(get('count'));
  if (Number.isFinite(count) && count > 0) draft.count = Math.floor(count);
  return draft;
}

export function coerceImageDraft(
  draft: ImageWorkbenchDraft,
  opts: { sizes: string[]; qualities: string[]; maxCount: number },
): ImageWorkbenchDraft {
  const out: ImageWorkbenchDraft = {};
  if (draft.prompt) out.prompt = draft.prompt;
  if (draft.size && opts.sizes.includes(draft.size)) out.size = draft.size;
  if (draft.quality && opts.qualities.includes(draft.quality)) out.quality = draft.quality;
  if (typeof draft.count === 'number' && opts.maxCount > 1) {
    const clamped = Math.min(Math.max(draft.count, 1), opts.maxCount);
    if (clamped > 1) out.count = clamped;
  }
  return out;
}

export function parseVideoDraftQuery(get: (k: string) => string | null): VideoWorkbenchDraft {
  const draft: VideoWorkbenchDraft = {};
  const prompt = cleanString(get('prompt'));
  if (prompt) draft.prompt = prompt;
  const durationRaw = get('duration');
  if (durationRaw !== null && durationRaw.trim() !== '') {
    draft.duration = normalizeVideoDuration(durationRaw);
  }
  const resolution = cleanString(get('resolution'));
  if (resolution) draft.resolution = resolution;
  const ratio = cleanString(get('ratio'));
  if (ratio) draft.ratio = ratio;
  const audio = parseGenerateAudioParam(get('generateAudio'));
  if (audio !== undefined) draft.generateAudio = audio;
  const mode = cleanString(get('mode'));
  if (mode) draft.mode = mode;
  return draft;
}

export function coerceVideoDraft(
  draft: VideoWorkbenchDraft,
  opts: { resolutions: string[] },
): VideoWorkbenchDraft {
  const out: VideoWorkbenchDraft = {};
  if (draft.prompt) out.prompt = draft.prompt;
  if (typeof draft.duration === 'number' && draft.duration > 0) out.duration = draft.duration;
  if (draft.resolution && opts.resolutions.includes(draft.resolution)) {
    out.resolution = draft.resolution;
  }
  if (draft.ratio && (RATIO_VALUES as readonly string[]).includes(draft.ratio)) {
    out.ratio = draft.ratio;
  }
  if (typeof draft.generateAudio === 'boolean') out.generateAudio = draft.generateAudio;
  if (draft.mode && isVideoWorkspaceMode(draft.mode)) out.mode = draft.mode;
  return out;
}
