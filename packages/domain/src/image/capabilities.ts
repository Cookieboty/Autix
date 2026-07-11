// Image model capability table.
//
// This module is intentionally zero-dependency pure TypeScript so that both
// the React UI and the Nest API can import it via `@autix/domain/image`
// without pulling axios, React, or any other runtime into the consumer.

export type ImageModelKind =
  | 'gpt-image'
  | 'gemini-flash-image'
  | 'gemini-3-pro-image'
  | 'gemini-3-flash-image'
  | 'compatible';

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
  // 只存稳定的 value token（'low' | 'standard' | ...），不放显示文案。这是 zero-dep 领域层，
  // 无法本地化；显示名由 UI 层用 i18n(pricing.options.<value>) 翻译。放中文/任何自然语言
  // label 在这里，就会出现「英文界面显示中文档位」的架构问题。
  qualities: string[];
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
    configuredKind === 'gemini-flash-image' ||
    configuredKind === 'gemini-3-pro-image' ||
    configuredKind === 'gemini-3-flash-image' ||
    configuredKind === 'compatible'
  ) {
    return configuredKind;
  }
  const id = `${hint?.provider ?? ''} ${hint?.model ?? ''}`.toLowerCase();
  if (id.includes('gpt-image')) return 'gpt-image';
  if (
    id.includes('gemini-3.1') ||
    id.includes('gemini 3.1') ||
    id.includes('gemini-31') ||
    (id.includes('gemini-3') && id.includes('flash')) ||
    (id.includes('gemini 3') && id.includes('flash'))
  ) {
    return 'gemini-3-flash-image';
  }
  if (id.includes('gemini-3') || id.includes('gemini 3')) return 'gemini-3-pro-image';
  if (id.includes('gemini')) return 'gemini-flash-image';
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
const GEMINI_25_FLASH_ASPECT_SIZES = [
  { label: '1:1', value: '1024x1024' },
  { label: '2:3', value: '832x1248' },
  { label: '3:2', value: '1248x832' },
  { label: '3:4', value: '864x1184' },
  { label: '4:3', value: '1184x864' },
  { label: '4:5', value: '896x1152' },
  { label: '5:4', value: '1152x896' },
  { label: '9:16', value: '768x1344' },
  { label: '16:9', value: '1344x768' },
  { label: '21:9', value: '1536x672' },
];

type GeminiImageSize = '512px' | '1K' | '2K' | '4K';
type GeminiResolutionRow = {
  label: string;
  sizes: Partial<Record<GeminiImageSize, string>>;
};

const GEMINI_31_FLASH_RESOLUTION_ROWS: GeminiResolutionRow[] = [
  { label: '1:1', sizes: { '512px': '512x512', '1K': '1024x1024', '2K': '2048x2048', '4K': '4096x4096' } },
  { label: '1:4', sizes: { '512px': '256x1024', '1K': '512x2048', '2K': '1024x4096', '4K': '2048x8192' } },
  { label: '1:8', sizes: { '512px': '192x1536', '1K': '384x3072', '2K': '768x6144', '4K': '1536x12288' } },
  { label: '2:3', sizes: { '512px': '424x632', '1K': '848x1264', '2K': '1696x2528', '4K': '3392x5056' } },
  { label: '3:2', sizes: { '512px': '632x424', '1K': '1264x848', '2K': '2528x1696', '4K': '5056x3392' } },
  { label: '3:4', sizes: { '512px': '448x600', '1K': '896x1200', '2K': '1792x2400', '4K': '3584x4800' } },
  { label: '4:1', sizes: { '512px': '1024x256', '1K': '2048x512', '2K': '4096x1024', '4K': '8192x2048' } },
  { label: '4:3', sizes: { '512px': '600x448', '1K': '1200x896', '2K': '2400x1792', '4K': '4800x3584' } },
  { label: '4:5', sizes: { '512px': '464x576', '1K': '928x1152', '2K': '1856x2304', '4K': '3712x4608' } },
  { label: '5:4', sizes: { '512px': '576x464', '1K': '1152x928', '2K': '2304x1856', '4K': '4608x3712' } },
  { label: '8:1', sizes: { '512px': '1536x192', '1K': '3072x384', '2K': '6144x768', '4K': '12288x1536' } },
  { label: '9:16', sizes: { '512px': '384x688', '1K': '768x1376', '2K': '1536x2752', '4K': '3072x5504' } },
  { label: '16:9', sizes: { '512px': '688x384', '1K': '1376x768', '2K': '2752x1536', '4K': '5504x3072' } },
  { label: '21:9', sizes: { '512px': '792x168', '1K': '1584x672', '2K': '3168x1344', '4K': '6336x2688' } },
];

const GEMINI_3_PRO_RESOLUTION_ROWS = GEMINI_31_FLASH_RESOLUTION_ROWS
  .filter((row) => !['1:4', '4:1', '1:8', '8:1'].includes(row.label));

function geminiSizeOptions(rows: GeminiResolutionRow[], imageSizes: GeminiImageSize[]) {
  return imageSizes.flatMap((imageSize) =>
    rows.flatMap((row) => {
      const value = row.sizes[imageSize];
      if (!value) return [];
      return [{
        label: imageSize === '1K' ? row.label : `${row.label} ${imageSize}`,
        value: `${value}@${imageSize}`,
      }];
    }),
  );
}

export const IMAGE_MODEL_CAPABILITIES: Record<ImageModelKind, ImageModelCapability> = {
  // gpt-image (gpt-image-2)
  // Docs: https://platform.openai.com/docs/api-reference/images/create
  //       https://platform.openai.com/docs/guides/image-generation
  // size:    "auto" | "1024x1024" | "1536x1024" | "1024x1536"
  //          | "2048x2048" | "2048x1152" | "3840x2160" | "2160x3840"
  // quality: "auto" | "low" | "medium" | "high"
  // n:       not exposed by Autix for gpt-image-2; count is fixed at 1.
  'gpt-image': {
    kind: 'gpt-image',
    displayName: 'GPT Image',
    sizes: [
      { label: '1:1', value: '1024x1024' },        // OpenAI Images API · size
      { label: '3:2', value: '1536x1024' },        // OpenAI Images API · size
      { label: '2:3', value: '1024x1536' },        // OpenAI Images API · size
      { label: '1:1 2K', value: '2048x2048' },     // OpenAI Images API · size
      { label: '16:9 2K', value: '2048x1152' },    // OpenAI Images API · size
      { label: '16:9 4K', value: '3840x2160' },    // OpenAI Images API · size
      { label: '9:16 4K', value: '2160x3840' },    // OpenAI Images API · size
    ],
    qualities: ['low', 'medium', 'high'],
    maxCount: 1,
    // 不再提供「自动」：sizes / qualities 里都已移除 auto，默认选中 1:1。
    defaults: { size: '1024x1024', quality: 'medium', count: 1 },
    supportsReferenceImage: true,
    supportsSourceImage: true,
    supportsNegativePrompt: 'prompt-injected',
    showAdvancedSliders: false,
  },

  // gemini-flash-image (Gemini 2.5 Flash Image)
  // Docs: https://ai.google.dev/gemini-api/docs/image-generation
  // aspectRatio: "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9" | "21:9"
  // REST path: generationConfig.responseFormat.image.aspectRatio
  'gemini-flash-image': {
    kind: 'gemini-flash-image',
    displayName: 'Gemini 2.5 Flash Image',
    sizes: GEMINI_25_FLASH_ASPECT_SIZES,
    qualities: [],
    maxCount: 1,
    defaults: { size: '1024x1024', quality: '', count: 1 },
    supportsReferenceImage: true,
    supportsSourceImage: true,
    supportsNegativePrompt: 'prompt-injected',
    showAdvancedSliders: false,
    notes:
      'Gemini 2.5 Flash Image 官方使用 aspectRatio，不单独暴露 image_size；Autix 固定单张生成。',
  },

  // gemini-3-pro-image (Gemini 3 Pro Image)
  // Docs: https://ai.google.dev/gemini-api/docs/image-generation
  // aspectRatio: common 10 ratios.
  // image_size: "1K" | "2K" | "4K".
  // UI encodes aspectRatio + image_size into stable size tokens.
  'gemini-3-pro-image': {
    kind: 'gemini-3-pro-image',
    displayName: 'Gemini 3 Pro Image',
    sizes: geminiSizeOptions(GEMINI_3_PRO_RESOLUTION_ROWS, ['1K', '2K', '4K']),
    qualities: [],
    maxCount: 1,
    defaults: { size: '1024x1024@1K', quality: '', count: 1 },
    supportsReferenceImage: true,
    supportsSourceImage: true,
    supportsNegativePrompt: 'prompt-injected',
    showAdvancedSliders: false,
    notes:
      'Gemini 3 Pro Image 官方支持 aspect_ratio + image_size；Autix 固定单张生成。',
  },

  // gemini-3-flash-image (Gemini 3.1 Flash Image)
  // Docs: https://ai.google.dev/gemini-api/docs/image-generation
  // aspectRatio: common 10 ratios plus 1:4, 4:1, 1:8, 8:1.
  // image_size: "512px" | "1K" | "2K" | "4K".
  // UI encodes aspectRatio + image_size into stable size tokens.
  'gemini-3-flash-image': {
    kind: 'gemini-3-flash-image',
    displayName: 'Gemini 3.1 Flash Image',
    sizes: geminiSizeOptions(GEMINI_31_FLASH_RESOLUTION_ROWS, ['1K', '2K', '4K', '512px']),
    qualities: [],
    maxCount: 1,
    defaults: { size: '1024x1024@1K', quality: '', count: 1 },
    supportsReferenceImage: true,
    supportsSourceImage: true,
    supportsNegativePrompt: 'prompt-injected',
    showAdvancedSliders: false,
    notes:
      'Gemini 3.1 Flash Image 官方支持更多长宽比和 512px/1K/2K/4K；Autix 固定单张生成。',
  },

  // compatible (OpenAI-Compatible protocol / self-hosted SDXL / Flux / …)
  // ⚠ Non-canonical: OpenAI-Compatible is not a single spec.
  // The enumerations below are the "greatest common denominator" published by
  // this spec; consult each vendor's own docs and adjust capability records or
  // inject `metadata.extraParams` as needed when integrating new providers.
  compatible: {
    kind: 'compatible',
    displayName: 'Compatible',
    sizes: [
      { label: '1:1', value: '1024x1024' },        // empirical, not official
      { label: '16:9', value: '1792x1024' },
      { label: '9:16', value: '1024x1792' },
      { label: '4:3', value: '1024x768' },
      { label: '3:4', value: '768x1024' },
    ],
    qualities: ['standard', 'hd'], // OpenAI protocol naming; 显示名走 i18n(pricing.options.*)
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
