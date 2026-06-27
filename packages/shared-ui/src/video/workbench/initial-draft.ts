import type { VideoWorkspaceMode } from './constants';

export interface VideoInitialDraft {
  prompt?: string;
  duration?: number;
  resolution?: string;
  ratio?: string;
  generateAudio?: boolean;
  mode?: string;
  materials?: Array<{
    url: string;
    name?: string;
    sourceType?: 'upload' | 'image_generation';
    sourceId?: string;
  }>;
}

export function buildVideoInitialDraftParams(
  draft: VideoInitialDraft,
  mode: VideoWorkspaceMode | null,
): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  if (draft.resolution !== undefined) params.resolution = draft.resolution;
  if (draft.ratio !== undefined) params.ratio = draft.ratio;
  if (draft.duration !== undefined) params.duration = draft.duration;
  if (draft.generateAudio !== undefined) params.generateAudio = draft.generateAudio;
  if (mode) params.generationMode = mode;
  if (mode === 'storyboard' && draft.prompt?.trim()) {
    params.storyboardPrompt = draft.prompt;
  }
  return params;
}
