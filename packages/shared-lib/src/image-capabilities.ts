// Image model capability table.
//
// This module is intentionally zero-dependency pure TypeScript so that both
// the React UI (`packages/shared-ui`) and the Nest API (`services/api`) can
// import it via the `@autix/shared-lib/image-capabilities` sub-path export
// without pulling axios, React, or any other runtime into the consumer.
//
// IMPORTANT: do NOT add imports from './api', './adapters', axios, react,
// or any other peer module. Keep this file dependency-free.

export type ImageModelKind = 'gpt-image' | 'gemini-nano' | 'compatible';

export interface ImageModelHint {
  provider?: string | null;
  model?: string | null;
  metadata?: {
    imageModelKind?: ImageModelKind | string | null;
    [key: string]: unknown;
  } | null;
}

export interface ImageModelCapability {
  kind: ImageModelKind;
  displayName: string;
  sizes: Array<{ label: string; value: string }>;
  qualities: Array<{ label: string; value: string }>;
  maxCount: number;
  defaults: { size: string; quality: string; count: number };
  supportsReferenceImage: boolean;
  supportsSourceImage: boolean;
  supportsNegativePrompt: 'native' | 'prompt-injected' | 'none';
  showAdvancedSliders: boolean;
  notes?: string;
}

export function detectImageModelKind(hint?: ImageModelHint | null): ImageModelKind {
  const configuredKind = hint?.metadata?.imageModelKind;
  if (
    configuredKind === 'gpt-image' ||
    configuredKind === 'gemini-nano' ||
    configuredKind === 'compatible'
  ) {
    return configuredKind;
  }
  const id = `${hint?.provider ?? ''} ${hint?.model ?? ''}`.toLowerCase();
  if (id.includes('gpt-image')) return 'gpt-image';
  if (id.includes('gemini')) return 'gemini-nano';
  return 'compatible';
}

// ────────────────────────────────────────────────────────────────────
// Capability records.
//
// All size / quality / maxCount enumerations carry an inline source comment.
// The aggregated link list lives in spec §15 appendix C.
// If the upstream documentation changes, the three places must be updated
// together: this table, the spec appendix, and the matching unit tests.
// ────────────────────────────────────────────────────────────────────
export const IMAGE_MODEL_CAPABILITIES: Record<ImageModelKind, ImageModelCapability> = {
  // gpt-image (gpt-image-1)
  // Docs: https://platform.openai.com/docs/api-reference/images/create
  //       https://platform.openai.com/docs/guides/images?api-mode=responses#sizes
  // size:    "auto" | "1024x1024" | "1536x1024" | "1024x1536"
  // quality: "auto" | "low" | "medium" | "high"
  // n:       1..10  (UI caps at 4 this iteration; see spec §5.2 note)
  'gpt-image': {
    kind: 'gpt-image',
    displayName: 'GPT Image',
    sizes: [
      { label: '智能比例', value: 'auto' },        // OpenAI Images API · size
      { label: '1:1', value: '1024x1024' },        // OpenAI Images API · size
      { label: '3:2', value: '1536x1024' },        // OpenAI Images API · size
      { label: '2:3', value: '1024x1536' },        // OpenAI Images API · size
    ],
    qualities: [
      { label: '自动', value: 'auto' },             // OpenAI Images API · quality (gpt-image-1)
      { label: '低', value: 'low' },
      { label: '中', value: 'medium' },
      { label: '高', value: 'high' },
    ],
    maxCount: 4,
    defaults: { size: 'auto', quality: 'auto', count: 1 },
    supportsReferenceImage: true,
    supportsSourceImage: true,
    supportsNegativePrompt: 'prompt-injected',
    showAdvancedSliders: false,
  },

  // gemini-nano (gemini-*-image family: 2.5-flash-image, 3-pro-image, 3.1-flash-image, …)
  // Docs: https://ai.google.dev/gemini-api/docs/image-generation
  // aspectRatio (14 official ratios; UI exposes 10 common ones this iteration):
  //   common 10: "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9" | "21:9"
  //   3.1 Flash Image-only: "1:4" | "4:1" | "1:8" | "8:1"  (not exposed)
  // REST path: generationConfig.responseFormat.image.aspectRatio
  // All *-image family models share this capability record (detection by 'gemini' substring).
  'gemini-nano': {
    kind: 'gemini-nano',
    displayName: 'Gemini Image',
    sizes: [
      { label: '1:1', value: '1024x1024' },        // Gemini API · responseFormat.image.aspectRatio
      { label: '3:2', value: '1536x1024' },        // Gemini API · responseFormat.image.aspectRatio
      { label: '2:3', value: '1024x1536' },        // Gemini API · responseFormat.image.aspectRatio
      { label: '4:3', value: '1024x768' },         // Gemini API · responseFormat.image.aspectRatio
      { label: '3:4', value: '768x1024' },         // Gemini API · responseFormat.image.aspectRatio
      { label: '4:5', value: '1024x1280' },        // Gemini API · responseFormat.image.aspectRatio
      { label: '5:4', value: '1280x1024' },        // Gemini API · responseFormat.image.aspectRatio
      { label: '16:9', value: '1792x1024' },       // Gemini API · responseFormat.image.aspectRatio
      { label: '9:16', value: '1024x1792' },       // Gemini API · responseFormat.image.aspectRatio
      { label: '21:9', value: '2016x864' },        // Gemini API · responseFormat.image.aspectRatio
    ],
    qualities: [],
    maxCount: 4,
    defaults: { size: '1024x1024', quality: '', count: 1 },
    supportsReferenceImage: true,
    supportsSourceImage: true,
    supportsNegativePrompt: 'prompt-injected',
    showAdvancedSliders: false,
    notes:
      'Gemini 通过并发调用实现多张生成，张数越多耗时与配额越高。官方支持 14 档 aspectRatio，UI 本期暴露 10 档常用比例。覆盖 gemini-*-image 全系列。',
  },

  // compatible (OpenAI-Compatible protocol / self-hosted SDXL / Flux / …)
  // ⚠ Non-canonical: OpenAI-Compatible is not a single spec.
  // The enumerations below are the "greatest common denominator" published by
  // this spec; consult each vendor's own docs and adjust capability records or
  // inject `metadata.extraParams` as needed when integrating new providers.
  compatible: {
    kind: 'compatible',
    displayName: '兼容模型',
    sizes: [
      { label: '1:1', value: '1024x1024' },        // empirical, not official
      { label: '16:9', value: '1792x1024' },
      { label: '9:16', value: '1024x1792' },
      { label: '4:3', value: '1024x768' },
      { label: '3:4', value: '768x1024' },
    ],
    qualities: [
      { label: '标准', value: 'standard' },         // OpenAI protocol naming
      { label: '高清', value: 'hd' },
    ],
    maxCount: 4,
    defaults: { size: '1024x1024', quality: 'standard', count: 1 },
    supportsReferenceImage: true,
    supportsSourceImage: true,
    supportsNegativePrompt: 'native',
    showAdvancedSliders: true,
    notes:
      '兼容服务（SDXL/Flux 等）支持引导强度、步数、种子等高级参数；具体取值需以服务商文档为准。',
  },
};

export function getImageCapability(kind: ImageModelKind): ImageModelCapability {
  return IMAGE_MODEL_CAPABILITIES[kind];
}
