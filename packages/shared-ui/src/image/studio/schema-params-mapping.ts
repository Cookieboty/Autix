import {
  buildImageSizeResolutionGroups,
  selectImageSizeResolution,
  type ImageModelCapability,
} from '@autix/domain/image';
import type { ImageStudioModelSettings } from './constants';

/**
 * Pure key+value translation from the billing schema's image params
 * (`imagePreset.paramsSchema`, packages/domain/src/pricing/presets.ts:
 * `quality` / `resolution` / `quantity` / `referenceImages`) to the real
 * generation settings bag consumed by the request builder
 * (`ImageStudioModelSettings`, packages/shared-ui/src/image/studio/constants.ts).
 *
 * Source of truth for each field (task 7 review CRITICAL 2):
 * - `quality` -> `quality`: identity rename. No value translation — the task
 *   brief's own mapping list states "quality → quality" as a straight
 *   passthrough (unlike `resolution`, no format mismatch was flagged for it).
 * - `quantity` -> `count`: identity rename (both plain integers).
 * - `resolution` -> `size`: KEY *and* VALUE translation. The schema's
 *   resolution tier ('512px' | '1K' | '2K' | '4K') and `size` (a concrete
 *   "WxH" or "WxH@tier" string, e.g. '2048x2048@2K') are different encodings
 *   of the same axis. The correspondence is NOT invented here — it already
 *   exists, is unit-tested, and was the exact logic the pre-Task-7
 *   `ImageStudioSettingsPanel` used for its resolution chips, in
 *   packages/domain/src/image/size-selection.ts:
 *     `buildImageSizeResolutionGroups(capability)` groups every capability's
 *     real `sizes` by inferred resolution tier (same '512px'/'1K'/'2K'/'4K'
 *     type as the pricing schema — see `ImagePricingResolution`), and
 *     `selectImageSizeResolution(currentSize, nextTier, groups)` returns the
 *     size string for that tier that keeps the currently-selected aspect
 *     ratio. For capabilities with only one resolution tier (`compatible`,
 *     `gemini-flash-image` — confirmed via probe: both only ever infer a
 *     single '1K' group because none of their real sizes has a longer side
 *     >= 1900px), selecting any other tier is a documented no-op that keeps
 *     the current size unchanged (`selectImageSizeResolution`'s own
 *     fallback) rather than writing a nonsensical value — those models
 *     genuinely have no distinguishable resolution axis to switch.
 */
export function schemaParamsToImageSettings(
  params: Record<string, unknown>,
  currentSize: string,
  capability: ImageModelCapability,
): Partial<Pick<ImageStudioModelSettings, 'size' | 'quality' | 'count'>> {
  const next: Partial<Pick<ImageStudioModelSettings, 'size' | 'quality' | 'count'>> = {};

  if (typeof params.resolution === 'string' && params.resolution) {
    const groups = buildImageSizeResolutionGroups(capability);
    next.size = selectImageSizeResolution(currentSize, params.resolution, groups);
  }

  if (typeof params.quality === 'string') {
    next.quality = params.quality;
  }

  if (typeof params.quantity === 'number' && Number.isFinite(params.quantity)) {
    next.count = params.quantity;
  }

  return next;
}
