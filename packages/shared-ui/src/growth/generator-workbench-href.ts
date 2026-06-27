export const GENERATOR_PROMPT_MAX = 1000;

export type GeneratorWorkbenchDraft = {
  kind: 'image' | 'video';
  model?: string | null;
  prompt?: string | null;
  templateId?: string | null;
  // image
  size?: string | null;
  quality?: string | null;
  count?: number | null;
  draftId?: string | null;
  // video
  duration?: number | null;
  resolution?: string | null;
  ratio?: string | null;
  generateAudio?: boolean | null;
  mode?: string | null;
};

export function buildGeneratorWorkbenchHref(draft: GeneratorWorkbenchDraft): string {
  const base = draft.kind === 'video' ? '/workbench/video' : '/workbench/image';
  const params = new URLSearchParams();
  if (draft.model) params.set('model', draft.model);
  if (draft.templateId) params.set('templateId', draft.templateId);
  const prompt = draft.prompt?.trim();
  if (prompt) params.set('prompt', prompt.slice(0, GENERATOR_PROMPT_MAX));

  if (draft.kind === 'image') {
    if (draft.size) params.set('size', draft.size);
    if (draft.quality) params.set('quality', draft.quality);
    if (draft.draftId) params.set('draftId', draft.draftId);
    if (typeof draft.count === 'number' && draft.count > 1) {
      params.set('count', String(draft.count));
    }
  } else {
    if (typeof draft.duration === 'number' && draft.duration > 0) {
      params.set('duration', String(draft.duration));
    }
    if (draft.resolution) params.set('resolution', draft.resolution);
    if (draft.ratio) params.set('ratio', draft.ratio);
    if (draft.generateAudio === true) params.set('generateAudio', '1');
    else if (draft.generateAudio === false) params.set('generateAudio', '0');
    if (draft.mode) params.set('mode', draft.mode);
    if (draft.draftId) params.set('draftId', draft.draftId);
  }

  params.set('source', 'public-generator');
  return `${base}?${params.toString()}`;
}
