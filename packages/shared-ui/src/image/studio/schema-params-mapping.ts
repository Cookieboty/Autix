import {
  buildImageSizeResolutionGroups,
  resolveImagePricingResolution,
  selectImageSizeResolution,
  type ImageModelCapability,
} from '@autix/domain/image';
import type { ImageStudioModelSettings } from './constants';

/**
 * 反向映射：把真实生成设置(ImageStudioModelSettings)换算回 SchemaForm 用的计价参数
 * (imagePreset.paramsSchema 的 quality/resolution/quantity)。用于用当前设置初始化/同步
 * 表单，避免表单用 schema 默认值覆盖已有设置(模板应用、历史恢复等外部来源)。
 * - size -> resolution：用 resolveImagePricingResolution(与 schemaParamsToImageSettings 的
 *   selectImageSizeResolution 互为逆) 从 size 字符串推断档位；推断不出时不写该键。
 * - quality -> quality：恒等改名。
 * 生成张数(count)不再是计价参数——已从图像 schema 移除，由业务逻辑吃掉，故这里不映射。
 */
export function imageSettingsToSchemaParams(
  settings: Pick<ImageStudioModelSettings, 'size' | 'quality'>,
): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  const resolution = resolveImagePricingResolution(settings.size);
  if (resolution) next.resolution = resolution;
  if (typeof settings.quality === 'string' && settings.quality) next.quality = settings.quality;
  return next;
}

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
 * - 生成张数(count)不再来自 schema：quantity 已从图像计价参数移除，由业务逻辑吃掉，
 *   所以这里不再从 params 写 count。
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
): Partial<Pick<ImageStudioModelSettings, 'size' | 'quality'>> {
  const next: Partial<Pick<ImageStudioModelSettings, 'size' | 'quality'>> = {};

  if (typeof params.resolution === 'string' && params.resolution) {
    const groups = buildImageSizeResolutionGroups(capability);
    next.size = selectImageSizeResolution(currentSize, params.resolution, groups);
  }

  if (typeof params.quality === 'string') {
    next.quality = params.quality;
  }

  // 生成张数(count)不再来自 schema —— quantity 已移除，count 由业务逻辑管理。

  return next;
}
