// Video model capability table.
//
// Keep this module dependency-free so the API, shared UI, and pricing admin can
// use one source of truth for model-specific video parameters.

export type VideoResolution = '480p' | '720p' | '1080p' | '4k';

export type VideoModelKind =
  | 'seedance-2.0'
  | 'seedance-2.0-fast'
  | 'seedance-2.0-mini'
  | 'seedance-1.5-pro'
  | 'seedance-1.0-pro'
  | 'seedance-1.0-pro-fast'
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

export const VIDEO_MODEL_CAPABILITIES: Record<VideoModelKind, VideoModelCapability> = {
  // Seedance 2.0 series: default 720p. 4K is only exposed for the base 2.0 line.
  'seedance-2.0': {
    kind: 'seedance-2.0',
    displayName: 'Seedance 2.0',
    resolutions: ['480p', '720p', '1080p', '4k'],
    defaultResolution: '720p',
  },
  'seedance-2.0-fast': {
    kind: 'seedance-2.0-fast',
    displayName: 'Seedance 2.0 Fast',
    resolutions: ['480p', '720p'],
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

  // Generic compatible video providers cannot assume 4K support.
  compatible: {
    kind: 'compatible',
    displayName: 'Compatible video model',
    resolutions: ['480p', '720p', '1080p'],
    defaultResolution: DEFAULT_VIDEO_RESOLUTION,
  },
};

function configuredVideoModelKind(value: unknown): VideoModelKind | null {
  if (
    value === 'seedance-2.0' ||
    value === 'seedance-2.0-fast' ||
    value === 'seedance-2.0-mini' ||
    value === 'seedance-1.5-pro' ||
    value === 'seedance-1.0-pro' ||
    value === 'seedance-1.0-pro-fast' ||
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

  return {
    ...base,
    resolutions,
    defaultResolution: resolutions.includes(defaultResolution)
      ? defaultResolution
      : resolutions[0] ?? base.defaultResolution,
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
