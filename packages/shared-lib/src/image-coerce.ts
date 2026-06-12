// Pure-TS parameter coercion helpers for the image workbench.
//
// Same zero-dependency rule as `./image-capabilities`: this file MUST NOT
// import from './api', './adapters', axios, react, or any other peer module.
// Only the in-package `./image-capabilities` sibling may be imported.

import {
  type ImageModelCapability,
  type ImageModelKind,
  IMAGE_MODEL_CAPABILITIES,
} from './image-capabilities';

// ────────────────────────────────────────────────────────────────────
// Client-side coercion (UI settings)
// ────────────────────────────────────────────────────────────────────

export interface ImageStudioSettingsShape {
  size: string;
  quality: string;
  count: number;
  guidanceScale: number;
  steps: number;
  seed: string;
  promptTuning: string;
  stylePreset: string;
  negativePrompt: string;
}

export type CoerceChangedKey = '尺寸' | '质量' | '张数' | '高级参数' | '反向提示词';

export interface CoerceClientResult<S extends ImageStudioSettingsShape> {
  settings: S;
  changed: CoerceChangedKey[];
}

// Used when a capability hides the advanced sliders. The actual UI default
// lives in `clients/web/app/(app)/workbench/image/page.tsx`; this fallback
// is only used when the caller does not pass `advancedDefaults`.
export const DEFAULT_ADVANCED_FALLBACKS = {
  guidanceScale: 7,
  steps: 30,
  seed: '',
} as const;

export function coerceClientSettings<S extends ImageStudioSettingsShape>(
  s: S,
  cap: ImageModelCapability,
  advancedDefaults: Pick<ImageStudioSettingsShape, 'guidanceScale' | 'steps' | 'seed'> = DEFAULT_ADVANCED_FALLBACKS,
): CoerceClientResult<S> {
  const changed: CoerceChangedKey[] = [];

  let size = s.size;
  if (!cap.sizes.some((o) => o.value === size)) {
    size = mapEquivalentSize(size, cap);
    changed.push('尺寸');
  }

  let quality = s.quality;
  if (cap.qualities.length === 0) {
    if (quality !== '') {
      quality = '';
      // Gemini-nano hides the quality control entirely; treat reset as silent.
    }
  } else if (!cap.qualities.some((o) => o.value === quality)) {
    quality = cap.defaults.quality;
    changed.push('质量');
  }

  let count = s.count;
  if (!Number.isFinite(count)) {
    count = cap.defaults.count;
    changed.push('张数');
  } else if (count > cap.maxCount) {
    count = cap.maxCount;
    changed.push('张数');
  } else if (count < 1) {
    count = 1;
    changed.push('张数');
  }

  let guidanceScale = s.guidanceScale;
  let steps = s.steps;
  let seed = s.seed;
  if (!cap.showAdvancedSliders) {
    guidanceScale = advancedDefaults.guidanceScale;
    steps = advancedDefaults.steps;
    seed = advancedDefaults.seed;
  }

  let negativePrompt = s.negativePrompt;
  if (cap.supportsNegativePrompt === 'none' && negativePrompt.trim()) {
    negativePrompt = '';
    changed.push('反向提示词');
  }

  return {
    settings: {
      ...s,
      size,
      quality,
      count,
      guidanceScale,
      steps,
      seed,
      negativePrompt,
    },
    changed,
  };
}

// ────────────────────────────────────────────────────────────────────
// Nearest-aspect mapping helper
// ────────────────────────────────────────────────────────────────────

/**
 * Parse a `"WxH"` value into its aspect ratio (W / H).
 * Returns null for `"auto"` and for anything that is not strictly `\d+x\d+`.
 */
function parseAspect(value: string): number | null {
  if (value === 'auto') return null;
  const m = /^(\d+)x(\d+)$/.exec(value);
  if (!m) return null;
  const w = Number(m[1]);
  const h = Number(m[2]);
  return w > 0 && h > 0 ? w / h : null;
}

/**
 * Map an out-of-whitelist size to the nearest legal size in `cap.sizes`.
 *
 * Strategy:
 *  1) If `cap` supports `"auto"` and the input is `"auto"` → `"auto"`.
 *  2) Parse the input aspect ratio; if unparseable → `cap.defaults.size`.
 *  3) Pick the candidate with the smallest |log(r_i / r_target)|.
 *  4) Tie-break: prefer the candidate whose longer side is closer to 1024.
 *  5) If no candidate is parseable → `cap.defaults.size`.
 */
export function mapEquivalentSize(value: string, cap: ImageModelCapability): string {
  const hasAuto = cap.sizes.some((o) => o.value === 'auto');
  if (value === 'auto' && hasAuto) return 'auto';

  const target = parseAspect(value);
  if (target == null) return cap.defaults.size;

  const candidates = cap.sizes.map((o) => o.value).filter((v) => v !== 'auto');

  let best: { value: string; dist: number; longer: number } | null = null;
  for (const v of candidates) {
    const r = parseAspect(v);
    if (r == null) continue;
    const dist = Math.abs(Math.log(r / target));
    const [w, h] = v.split('x').map(Number);
    const longer = Math.max(w, h);
    if (
      !best ||
      dist < best.dist - 1e-9 ||
      (Math.abs(dist - best.dist) < 1e-9 && Math.abs(longer - 1024) < Math.abs(best.longer - 1024))
    ) {
      best = { value: v, dist, longer };
    }
  }
  return best?.value ?? cap.defaults.size;
}

// ────────────────────────────────────────────────────────────────────
// Server-side coercion (defensive normalization before adapter dispatch)
// ────────────────────────────────────────────────────────────────────

export interface CoerceInput {
  kind: ImageModelKind;
  size?: string;
  quality?: string;
  count?: number;
  negativePrompt?: string;
}

export interface CoerceOutput {
  size?: string;
  quality?: string;
  count: number;
  negativePrompt?: string;
  /** Human-readable notes about every mutation, suitable for warn-logging. */
  notes: string[];
}

export function coerceImageParams(input: CoerceInput): CoerceOutput {
  const cap = IMAGE_MODEL_CAPABILITIES[input.kind];
  const notes: string[] = [];

  let size: string | undefined = input.size ?? cap.defaults.size;
  if (!cap.sizes.some((o) => o.value === size)) {
    const fixed = mapEquivalentSize(size ?? '', cap);
    notes.push(`size ${size ?? '<empty>'} → ${fixed} (nearest aspect)`);
    size = fixed;
  }

  let quality: string | undefined = input.quality;
  if (cap.qualities.length === 0) {
    if (quality !== undefined && quality !== '') {
      notes.push(`quality ${quality} dropped (kind=${input.kind} has no quality dimension)`);
    }
    quality = undefined;
  } else {
    if (quality === undefined || quality === '') {
      quality = cap.defaults.quality;
    } else if (!cap.qualities.some((o) => o.value === quality)) {
      notes.push(`quality ${quality} → ${cap.defaults.quality} (fallback to default)`);
      quality = cap.defaults.quality;
    }
  }

  let count = input.count ?? cap.defaults.count;
  if (!Number.isFinite(count)) {
    notes.push(`count ${input.count} → ${cap.defaults.count} (non-finite fallback)`);
    count = cap.defaults.count;
  } else if (count > cap.maxCount) {
    notes.push(`count ${count} → ${cap.maxCount} (clamped to maxCount)`);
    count = cap.maxCount;
  } else if (count < 1) {
    notes.push(`count ${count} → 1 (clamped to minimum)`);
    count = 1;
  }

  let negativePrompt = input.negativePrompt;
  if (cap.supportsNegativePrompt === 'none' && negativePrompt && negativePrompt.trim()) {
    notes.push('negativePrompt dropped (kind does not support it)');
    negativePrompt = undefined;
  }

  return { size, quality, count, negativePrompt, notes };
}
