/**
 * Pure key translation from the billing schema's video params
 * (`videoPreset.paramsSchema`, packages/domain/src/pricing/presets.ts:
 * `resolution` / `seconds` / `ratio`) to the clip params bag every generation
 * consumer reads (`VideoClip.params`, merged via `updateSelectedClipParams`
 * in useVideoWorkbenchClipController.ts; read by `buildVideoEstimateInput` /
 * the estimate dialog / clip generation in constants.ts).
 *
 * Source of truth for each field (task 7 review CRITICAL 1):
 * - `seconds` -> `duration`: KEY translation only. Every clip-params consumer
 *   (`buildVideoEstimateInput`, `normalizeVideoDuration`, clip duration
 *   display) reads `params.duration`; the schema calls the same integer-second
 *   value `seconds`. No value translation needed — both are the same plain
 *   integer count of seconds (schema: `minimum: 4, maximum: 15`; clip:
 *   `normalizeVideoDuration` clamps to a positive integer with the same
 *   default of 5).
 * - `resolution` -> `resolution`: identity, key AND value. The schema's enum
 *   ('480p' | '720p' | '1080p' | '4k') is exactly `VideoResolution` from
 *   packages/domain/src/video/capabilities.ts, the same type
 *   `normalizeVideoResolutionForModel` and `clip.params.resolution` already
 *   use — confirmed by comparing the literal enum lists.
 * - `ratio` -> `ratio`: identity, key AND value. The schema's enum
 *   ('1:1' | '16:9' | '9:16') is a subset of `RATIO_VALUES` in
 *   packages/shared-ui/src/video/workbench/constants.ts — same string format,
 *   just a narrower selectable set; no translation required.
 */
export function schemaParamsToVideoClipParams(
  params: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = {};

  if ('seconds' in params) {
    next.duration = params.seconds;
  }
  if ('resolution' in params) {
    next.resolution = params.resolution;
  }
  if ('ratio' in params) {
    next.ratio = params.ratio;
  }

  return next;
}
