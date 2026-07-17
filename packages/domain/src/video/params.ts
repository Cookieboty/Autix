// 视频参数词汇与投影。
//
// **词汇即火山原生**：paramsSchema / pricingSchema / preset 的 paramBindings 全部直接
// 用火山方舟的原生字段名（`duration` / `generate_audio` / `return_last_frame` / `ratio` /
// `resolution` / `watermark` / `seed`），不再有"内部统一词汇 → 原生"的重命名层。
// 这里仍是**唯一**的归一化点：把 clip 侧历史双写（`generateAudio` 与 `generate_audio`）
// 收敛成单一原生名，保证报价、扣费、实际生成三者同源。
//
// 没有全局参数白名单：原生化后每家 preset 用各家 wire 字段名，不存在跨 preset 的
// "统一参数集"。防拼错由 preset 的 paramBindings + golden（wire 逐字节）+ 跨配置
// 校验器的正向闭合共同保证，不需要一个写死的常量。

/** 火山原生参数（与 paramsSchema 字段名一一对应，preset 的 paramBindings 直接透传）。 */
export type UnifiedVideoParams = {
  duration?: number;
  resolution?: string;
  ratio?: string;
  generate_audio?: boolean;
  watermark?: boolean;
  return_last_frame?: boolean;
  seed?: number;
};

/**
 * clip 侧的输入词汇（含历史字段 `duration`）。从 services/api 迁入，保持 domain 零
 * service 依赖。字段集是 services/api 现有 `VideoGenerationClipParams` 的完整迁移——
 * 除投影用到的字段外，还包含 `generate_audio`/`modelConfigId`/`generationMode`/
 * `storyboardPrompt`/`sourceTemplateId`/`sourceTemplateKind` 等不参与投影、仅随类型
 * 归位的字段，缺一个都会破坏现有调用方。
 */
export interface VideoGenerationClipParams {
  model?: string;
  resolution?: string;
  ratio?: string;
  duration?: number;
  seed?: number;
  generateAudio?: boolean;
  generate_audio?: boolean;
  watermark?: boolean;
  /**
   * 注意：**当前没有任何生产者往 clip 参数里写这个字段**。上游请求体里的
   * `return_last_frame` 目前来自 service 层的硬编码本地变量（`video-generation-flow.service.ts`
   * 里 `const returnLastFrame = false`），不经过 clip params，故本字段在
   * `toUnifiedVideoParams` 里对应的分支今天不会被真实数据触发。
   *
   * 保留它是为协议引擎预留（`arkVideoV3` 的 paramBindings 需要 `return_last_frame`）。
   * 接引擎时必须先决定这个值从哪来 —— 是让 clip 级配置真正驱动它，还是继续由
   * service 层提供、不走本投影。在那之前不要以为它已经生效。
   */
  returnLastFrame?: boolean;
  modelConfigId?: string;
  generationMode?: string;
  storyboardPrompt?: string;
  sourceTemplateId?: string;
  sourceTemplateKind?: 'video_template' | 'video_workflow_template';
}

/** clip 词汇 → 火山原生参数。未设置的键一律不出现在结果里（不写 undefined 占位）。 */
export function toUnifiedVideoParams(clip: VideoGenerationClipParams): UnifiedVideoParams {
  const native: UnifiedVideoParams = {};
  // duration 直接透传 —— paramsSchema 与 wire 都叫 duration，不再重命名成 seconds。
  if (clip.duration !== undefined) native.duration = clip.duration;
  if (clip.resolution !== undefined) native.resolution = clip.resolution;
  if (clip.ratio !== undefined) native.ratio = clip.ratio;
  // 唯一还需归一化的地方：clip params 历史上同时存在 generateAudio 与 generate_audio
  // 两种写法，`??` 收敛成单一原生名 generate_audio（语义须与 services 侧
  // resolveVideoGenerateAudio 一致 —— 那是本投影取代的对象）。
  const generateAudio = clip.generateAudio ?? clip.generate_audio;
  if (generateAudio !== undefined) native.generate_audio = generateAudio;
  if (clip.watermark !== undefined) native.watermark = clip.watermark;
  if (clip.returnLastFrame !== undefined) native.return_last_frame = clip.returnLastFrame;
  if (clip.seed !== undefined) native.seed = clip.seed;
  return native;
}
