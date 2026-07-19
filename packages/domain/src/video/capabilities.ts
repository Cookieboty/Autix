// Video model capability table.
//
// Keep this module dependency-free so the API, shared UI, and pricing admin can
// use one source of truth for model-specific video parameters.

export type VideoResolution = '480p' | '720p' | '1080p' | '4k';

export type VideoAspectRatio =
  | 'adaptive'
  | 'auto'
  | '16:9'
  | '9:16'
  | '4:3'
  | '3:4'
  | '1:1'
  | '21:9';

export type VideoModelKind =
  | 'seedance-2.0'
  | 'seedance-2.0-fast'
  | 'seedance-2.0-mini'
  | 'seedance-1.5-pro'
  | 'seedance-1.0-pro'
  | 'seedance-1.0-pro-fast'
  | 'veo3.1-fast'
  | 'veo3.1-lite'
  | 'veo3.1-quality'
  | 'compatible';

export interface VideoModelHint {
  provider?: string | null;
  model?: string | null;
  metadata?: {
    videoModelKind?: VideoModelKind | string | null;
    pricingResolutions?: unknown;
    supportedResolutions?: unknown;
    videoResolutions?: unknown;
    resolutions?: unknown;
    resolutionOptions?: unknown;
    maxResolution?: unknown;
    videoMaxResolution?: unknown;
    defaultResolution?: unknown;
    videoDefaultResolution?: unknown;
    [key: string]: unknown;
  } | null;
}

export interface VideoModelCapability {
  kind: VideoModelKind;
  displayName: string;
  resolutions: VideoResolution[];
  defaultResolution: VideoResolution;
  durations: number[];
  defaultDuration: number;
  ratios: VideoAspectRatio[];
  defaultRatio: VideoAspectRatio;
  audio: boolean;
}

export const VIDEO_RESOLUTION_OPTIONS: Array<{ value: VideoResolution; label: string }> = [
  { value: '480p', label: '480p' },
  { value: '720p', label: '720p' },
  { value: '1080p', label: '1080p' },
  { value: '4k', label: '4K' },
];

export const VIDEO_RESOLUTION_VALUES = VIDEO_RESOLUTION_OPTIONS.map((option) => option.value);

export const VIDEO_RESOLUTION_RANK: Record<VideoResolution, number> = {
  '480p': 1,
  '720p': 2,
  '1080p': 3,
  '4k': 4,
};

export const DEFAULT_VIDEO_RESOLUTION: VideoResolution = '720p';

export const VIDEO_ASPECT_RATIO_VALUES: VideoAspectRatio[] = [
  'adaptive',
  '16:9',
  '9:16',
  '4:3',
  '3:4',
  '1:1',
  '21:9',
];

export const VIDEO_DURATION_VALUES: number[] = [4, 5, 6, 7, 8, 9, 10, 11, 12, 15];

export const DEFAULT_VIDEO_DURATION = 5;

export const DEFAULT_VIDEO_ASPECT_RATIO: VideoAspectRatio = 'adaptive';

type VideoModelCapabilityBase = Pick<
  VideoModelCapability,
  'kind' | 'displayName' | 'resolutions' | 'defaultResolution'
> &
  Partial<VideoModelCapability>;

const VIDEO_MODEL_CAPABILITY_BASES: Record<VideoModelKind, VideoModelCapabilityBase> = {
  // Seedance 2.0 系列。分辨率按上游文档（amux doubao-seedance-2）：
  // 基础版 720p/1080p，fast 版**仅 720p**。此前表里给的是 480p/720p/1080p/4k 与
  // 480p/720p —— 那些多出来的档位上游并不支持，用户选中即必然失败。
  'seedance-2.0': {
    kind: 'seedance-2.0',
    displayName: 'Seedance 2.0',
    resolutions: ['720p', '1080p'],
    defaultResolution: '720p',
  },
  'seedance-2.0-fast': {
    kind: 'seedance-2.0-fast',
    displayName: 'Seedance 2.0 Fast',
    resolutions: ['720p'],
    defaultResolution: '720p',
  },
  'seedance-2.0-mini': {
    kind: 'seedance-2.0-mini',
    displayName: 'Seedance 2.0 Mini',
    resolutions: ['480p', '720p'],
    defaultResolution: '720p',
  },

  // Seedance 1.5 Pro defaults to 720p.
  'seedance-1.5-pro': {
    kind: 'seedance-1.5-pro',
    displayName: 'Seedance 1.5 Pro',
    resolutions: ['480p', '720p', '1080p'],
    defaultResolution: '720p',
  },

  // Seedance 1.0 Pro / Pro Fast default to 1080p.
  'seedance-1.0-pro': {
    kind: 'seedance-1.0-pro',
    displayName: 'Seedance 1.0 Pro',
    resolutions: ['480p', '720p', '1080p'],
    defaultResolution: '1080p',
  },
  'seedance-1.0-pro-fast': {
    kind: 'seedance-1.0-pro-fast',
    displayName: 'Seedance 1.0 Pro Fast',
    resolutions: ['480p', '720p', '1080p'],
    defaultResolution: '1080p',
  },

  // PoYo VEO 3.1 官方系列：aspect_ratio 只有 auto/16:9/9:16，duration 4/6/8。
  // fast/quality 支持 4K，lite 不支持 4K。defaultRatio 用 16:9（auto 仅图生视频/首尾帧可用，
  // 文生视频用 auto 会被 PoYo 拒）。
  'veo3.1-fast': {
    kind: 'veo3.1-fast',
    displayName: 'VEO 3.1 Fast',
    resolutions: ['720p', '1080p', '4k'],
    defaultResolution: '720p',
    durations: [4, 6, 8],
    defaultDuration: 8,
    ratios: ['16:9', '9:16', 'auto'],
    defaultRatio: '16:9',
  },
  'veo3.1-lite': {
    kind: 'veo3.1-lite',
    displayName: 'VEO 3.1 Lite',
    resolutions: ['720p', '1080p'],
    defaultResolution: '720p',
    durations: [4, 6, 8],
    defaultDuration: 8,
    ratios: ['16:9', '9:16', 'auto'],
    defaultRatio: '16:9',
  },
  'veo3.1-quality': {
    kind: 'veo3.1-quality',
    displayName: 'VEO 3.1 Quality',
    resolutions: ['720p', '1080p', '4k'],
    defaultResolution: '720p',
    durations: [4, 6, 8],
    defaultDuration: 8,
    ratios: ['16:9', '9:16', 'auto'],
    defaultRatio: '16:9',
  },

  // Generic compatible video providers cannot assume 4K support.
  compatible: {
    kind: 'compatible',
    displayName: 'Compatible video model',
    resolutions: ['480p', '720p', '1080p'],
    defaultResolution: DEFAULT_VIDEO_RESOLUTION,
  },
};

function withVideoCapabilityDefaults(base: VideoModelCapabilityBase): VideoModelCapability {
  return {
    durations: VIDEO_DURATION_VALUES,
    defaultDuration: DEFAULT_VIDEO_DURATION,
    ratios: VIDEO_ASPECT_RATIO_VALUES,
    defaultRatio: DEFAULT_VIDEO_ASPECT_RATIO,
    audio: true,
    ...base,
  };
}

export const VIDEO_MODEL_CAPABILITIES = Object.fromEntries(
  (Object.keys(VIDEO_MODEL_CAPABILITY_BASES) as VideoModelKind[]).map((kind) => [
    kind,
    withVideoCapabilityDefaults(VIDEO_MODEL_CAPABILITY_BASES[kind]),
  ]),
) as Record<VideoModelKind, VideoModelCapability>;

function configuredVideoModelKind(value: unknown): VideoModelKind | null {
  if (
    value === 'seedance-2.0' ||
    value === 'seedance-2.0-fast' ||
    value === 'seedance-2.0-mini' ||
    value === 'seedance-1.5-pro' ||
    value === 'seedance-1.0-pro' ||
    value === 'seedance-1.0-pro-fast' ||
    value === 'veo3.1-fast' ||
    value === 'veo3.1-lite' ||
    value === 'veo3.1-quality' ||
    value === 'compatible'
  ) {
    return value;
  }
  return null;
}

function includesVersion(id: string, major: string, minor: string) {
  return (
    id.includes(`${major}.${minor}`) ||
    id.includes(`${major}-${minor}`) ||
    id.includes(`${major}_${minor}`) ||
    id.includes(`${major} ${minor}`)
  );
}

export function detectVideoModelKind(hint?: VideoModelHint | null): VideoModelKind {
  const configured = configuredVideoModelKind(hint?.metadata?.videoModelKind);
  if (configured) return configured;

  const id = `${hint?.provider ?? ''} ${hint?.model ?? ''}`.toLowerCase();

  // PoYo VEO 3.1：按 model-id 里的档位词判定（veo3.1-fast/lite/quality-official）。
  if (id.includes('veo')) {
    if (id.includes('lite')) return 'veo3.1-lite';
    if (id.includes('quality')) return 'veo3.1-quality';
    return 'veo3.1-fast';
  }

  const isSeedance = id.includes('seedance') || id.includes('doubao-seedance');
  if (!isSeedance) return 'compatible';

  const isFast = id.includes('fast');
  const isMini = id.includes('mini');
  if (includesVersion(id, '2', '0') || id.includes('2.0')) {
    if (isMini) return 'seedance-2.0-mini';
    if (isFast) return 'seedance-2.0-fast';
    return 'seedance-2.0';
  }
  if (includesVersion(id, '1', '5') || id.includes('1.5')) return 'seedance-1.5-pro';
  if (includesVersion(id, '1', '0') || id.includes('1.0')) {
    return isFast ? 'seedance-1.0-pro-fast' : 'seedance-1.0-pro';
  }

  return isFast ? 'seedance-1.0-pro-fast' : 'seedance-1.0-pro';
}

export function normalizeVideoResolution(value: unknown): VideoResolution {
  const text = String(value ?? DEFAULT_VIDEO_RESOLUTION).trim().toLowerCase();
  if (text.includes('4k') || text.includes('2160')) return '4k';
  if (text.includes('1080')) return '1080p';
  if (text.includes('720')) return '720p';
  if (text.includes('480')) return '480p';
  return DEFAULT_VIDEO_RESOLUTION;
}

function stringList(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  return [];
}

function uniqueResolutions(values: unknown[]): VideoResolution[] {
  const seen = new Set<VideoResolution>();
  const result: VideoResolution[] = [];
  for (const value of values) {
    const resolution = normalizeVideoResolution(value);
    if (seen.has(resolution)) continue;
    seen.add(resolution);
    result.push(resolution);
  }
  return result.sort((a, b) => VIDEO_RESOLUTION_RANK[a] - VIDEO_RESOLUTION_RANK[b]);
}

function metadataResolutionList(metadata: VideoModelHint['metadata']) {
  if (!metadata || typeof metadata !== 'object') return [];
  for (const key of [
    'pricingResolutions',
    'supportedResolutions',
    'videoResolutions',
    'resolutions',
    'resolutionOptions',
  ] as const) {
    const resolutions = uniqueResolutions(stringList(metadata[key]));
    if (resolutions.length > 0) return resolutions;
  }
  return [];
}

function resolutionsUpTo(maxResolution: unknown) {
  const normalized = normalizeVideoResolution(maxResolution);
  const maxRank = VIDEO_RESOLUTION_RANK[normalized] ?? 0;
  return VIDEO_RESOLUTION_OPTIONS
    .map((option) => option.value)
    .filter((value) => VIDEO_RESOLUTION_RANK[value] <= maxRank);
}

function numberList(value: unknown): number[] {
  const arr = Array.isArray(value) ? value : typeof value === 'number' ? [value] : [];
  const out: number[] = [];
  for (const item of arr) {
    const n = Number(item);
    if (Number.isFinite(n) && n > 0) out.push(Math.round(n));
  }
  return Array.from(new Set(out)).sort((a, b) => a - b);
}

export function normalizeVideoAspectRatio(value: unknown): VideoAspectRatio | null {
  const text = String(value ?? '').trim().toLowerCase().replace(/\s+/g, '');
  switch (text) {
    case '16:9':
    case '9:16':
    case '4:3':
    case '3:4':
    case '1:1':
    case '21:9':
      return text;
    case 'adaptive':
    case 'auto':
      return 'adaptive';
    default:
      return null;
  }
}

function aspectRatioList(value: unknown): VideoAspectRatio[] {
  const arr = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  const out: VideoAspectRatio[] = [];
  for (const item of arr) {
    const ratio = normalizeVideoAspectRatio(item);
    if (ratio && !out.includes(ratio)) out.push(ratio);
  }
  return out;
}

function metadataDurationList(metadata: VideoModelHint['metadata']): number[] {
  if (!metadata || typeof metadata !== 'object') return [];
  for (const key of ['videoDurations', 'durations', 'durationOptions', 'supportedDurations'] as const) {
    const list = numberList(metadata[key]);
    if (list.length > 0) return list;
  }
  return [];
}

function metadataRatioList(metadata: VideoModelHint['metadata']): VideoAspectRatio[] {
  if (!metadata || typeof metadata !== 'object') return [];
  for (const key of ['videoRatios', 'ratios', 'aspectRatios', 'ratioOptions'] as const) {
    const list = aspectRatioList(metadata[key]);
    if (list.length > 0) return list;
  }
  return [];
}

function metadataAudioFlag(metadata: VideoModelHint['metadata']): boolean | null {
  if (!metadata || typeof metadata !== 'object') return null;
  for (const key of ['videoAudio', 'audio', 'supportsAudio', 'audioSupported'] as const) {
    const value = metadata[key];
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  return null;
}

export function resolveVideoModelCapability(
  hint?: VideoModelHint | null,
): VideoModelCapability {
  const base = VIDEO_MODEL_CAPABILITIES[detectVideoModelKind(hint)];
  const metadata = hint?.metadata;
  const explicitResolutions = metadataResolutionList(metadata);
  const maxResolution = metadata?.maxResolution ?? metadata?.videoMaxResolution;
  const maxResolutions = explicitResolutions.length > 0 || maxResolution == null
    ? []
    : resolutionsUpTo(maxResolution);
  const overrideResolutions = explicitResolutions.length > 0 ? explicitResolutions : maxResolutions;
  const constrained = overrideResolutions.length > 0
    ? base.kind === 'compatible'
      ? overrideResolutions
      : base.resolutions.filter((resolution) => overrideResolutions.includes(resolution))
    : base.resolutions;
  const resolutions = constrained.length > 0 ? constrained : base.resolutions;
  const configuredDefault = metadata?.defaultResolution ?? metadata?.videoDefaultResolution;
  const defaultResolution = configuredDefault == null
    ? base.defaultResolution
    : normalizeVideoResolution(configuredDefault);

  const overrideDurations = metadataDurationList(metadata);
  const durations = overrideDurations.length > 0 ? overrideDurations : base.durations;
  const configuredDefaultDuration = Number(
    metadata?.videoDefaultDuration ?? metadata?.defaultDuration,
  );
  const defaultDuration = durations.includes(configuredDefaultDuration)
    ? configuredDefaultDuration
    : durations.includes(base.defaultDuration)
      ? base.defaultDuration
      : durations[0] ?? base.defaultDuration;

  const overrideRatios = metadataRatioList(metadata);
  const ratios = overrideRatios.length > 0 ? overrideRatios : base.ratios;
  const configuredDefaultRatio = normalizeVideoAspectRatio(
    metadata?.videoDefaultRatio ?? metadata?.defaultRatio,
  );
  const defaultRatio = configuredDefaultRatio && ratios.includes(configuredDefaultRatio)
    ? configuredDefaultRatio
    : ratios.includes(base.defaultRatio)
      ? base.defaultRatio
      : ratios[0] ?? base.defaultRatio;

  const audioFlag = metadataAudioFlag(metadata);
  const audio = audioFlag == null ? base.audio : audioFlag;

  return {
    ...base,
    resolutions,
    defaultResolution: resolutions.includes(defaultResolution)
      ? defaultResolution
      : resolutions[0] ?? base.defaultResolution,
    durations,
    defaultDuration,
    ratios,
    defaultRatio,
    audio,
  };
}

export function getVideoResolutionOptionsForModel(
  hint?: VideoModelHint | null,
) {
  const capability = resolveVideoModelCapability(hint);
  const valueSet = new Set(capability.resolutions);
  return VIDEO_RESOLUTION_OPTIONS.filter((option) => valueSet.has(option.value));
}

export function getDefaultVideoResolutionForModel(
  hint?: VideoModelHint | null,
): VideoResolution {
  return resolveVideoModelCapability(hint).defaultResolution;
}

export function normalizeVideoResolutionForModel(
  value: unknown,
  hint?: VideoModelHint | null,
): VideoResolution {
  const capability = resolveVideoModelCapability(hint);
  const normalized = normalizeVideoResolution(value);
  return capability.resolutions.includes(normalized)
    ? normalized
    : capability.defaultResolution;
}
