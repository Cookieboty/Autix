/**
 * 计价 schema 的视频参数（`videoPreset.paramsSchema`，packages/domain/src/pricing/presets.ts:
 * `resolution` / `duration` / `ratio`）与 clip 参数袋（`VideoClip.params`，经
 * useVideoWorkbenchClipController.ts 的 `updateSelectedClipParams` 合并；由
 * `buildVideoEstimateInput` / 估价弹窗 / constants.ts 的 clip 生成读取）之间的键过滤。
 *
 * **原生化后三个字段全是恒等映射**：paramsSchema 已直接用火山原生名 `duration`（不再是
 * `seconds`），与 clip 参数同名，无需再改名。这两个函数保留的价值是**只放行这三个键**——
 * 挡住表单拿到非 schema 键、也挡住 clip 的非计价键（generateAudio/seed 等）回灌进表单。
 * - `duration`：恒等（原 `seconds`→`duration` 的改名随原生化删除）。
 * - `resolution`：恒等，schema enum 即 capabilities.ts 的 `VideoResolution`。
 * - `ratio`：恒等，schema enum 是 constants.ts `RATIO_VALUES` 的子集。
 */
export function schemaParamsToVideoClipParams(
  params: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = {};

  if ('duration' in params) {
    next.duration = params.duration;
  }
  if ('resolution' in params) {
    next.resolution = params.resolution;
  }
  if ('ratio' in params) {
    next.ratio = params.ratio;
  }

  return next;
}

/**
 * 反向映射：把 clip.params 换算回 SchemaForm 用的计价参数（paramsSchema 的
 * resolution/duration/ratio）。用于用当前 clip 参数初始化/同步表单，避免表单用 schema 默认值
 * 覆盖已有 clip 设置。原生化后是 schemaParamsToVideoClipParams 的逆——三个字段全恒等，
 * 仍只放行这三个计价键（丢掉 generateAudio/seed 等非计价 clip 键）。
 */
export function videoClipParamsToSchemaParams(
  clipParams: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = {};

  if ('duration' in clipParams) {
    next.duration = clipParams.duration;
  }
  if ('resolution' in clipParams) {
    next.resolution = clipParams.resolution;
  }
  if ('ratio' in clipParams) {
    next.ratio = clipParams.ratio;
  }

  return next;
}
