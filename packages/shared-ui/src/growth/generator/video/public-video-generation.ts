import type { PublicVideoReference } from '../generator-studio-helpers';

export const PUBLIC_VIDEO_DEFAULT_PARAMS = {
  duration: 5,
  ratio: '16:9',
  resolution: '1080p',
  generateAudio: true,
  generationMode: 'standard',
};

export const PUBLIC_VIDEO_RATIO_VALUES = [
  '16:9',
  '9:16',
  '4:3',
  '3:4',
  '1:1',
  '21:9',
  'adaptive',
] as const;

export interface PublicVideoGenerationPayload {
  title: string;
  prompt: string;
  params: Record<string, unknown>;
  materials: PublicVideoReference[];
}

export function buildPublicVideoGenerationPayload(input: {
  prompt: string;
  model: string;
  selectedModelId?: string | null;
  modelName?: string | null;
  duration: number;
  resolution: string;
  ratio: string;
  generateAudio: boolean;
  materials: PublicVideoReference[];
  templateId?: string | null;
}): PublicVideoGenerationPayload {
  const prompt = input.prompt.trim() || 'Create a cinematic short video';
  return {
    title: prompt.slice(0, 48),
    prompt,
    params: {
      ...PUBLIC_VIDEO_DEFAULT_PARAMS,
      duration: input.duration,
      resolution: input.resolution,
      ratio: input.ratio,
      generateAudio: input.generateAudio,
      generationMode: 'standard',
      model: input.modelName ?? input.model,
      ...(input.selectedModelId ? { modelConfigId: input.selectedModelId } : {}),
      ...(input.templateId ? { templateId: input.templateId } : {}),
    },
    materials: input.materials,
  };
}
