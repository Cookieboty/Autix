// 视频参数的统一词汇与投影。
//
// 存在的理由：clip 侧的历史/厂商词汇是 `duration`，而 paramsSchema 与计价用的是
// `seconds`。此前计价路径与前端各写一份归一化，两份实现一旦分叉就是线上的静默错价。
// 这里是**唯一**的投影点：报价、扣费、实际生成三者同源。

/**
 * 统一参数的运行时白名单。
 *
 * 必须是 const 数组而非仅有 interface —— TS interface 在运行时被类型擦除，
 * 协议配置校验器无法枚举它的键。校验器据此拒绝 preset 里的幽灵绑定
 * （例如拼错的 `wartermark` 会永远不生效且无人察觉）。
 */
export const UNIFIED_VIDEO_PARAM_KEYS = [
  'seconds',
  'resolution',
  'ratio',
  'generateAudio',
  'watermark',
  'returnLastFrame',
  'seed',
] as const;

export type UnifiedVideoParamKey = typeof UNIFIED_VIDEO_PARAM_KEYS[number];

/** 统一词汇（与 paramsSchema 对齐）。厂商叫什么由 preset 的 paramBindings 声明。 */
export type UnifiedVideoParams = {
  seconds?: number;
  resolution?: string;
  ratio?: string;
  generateAudio?: boolean;
  watermark?: boolean;
  returnLastFrame?: boolean;
  seed?: number;
};

// 常量与类型双向锁死：任一方缺键即编译期报错，避免加了字段忘了同步另一边。
type _AssertKeysCoverParams = UnifiedVideoParamKey extends keyof UnifiedVideoParams ? true : never;
type _AssertParamsCoverKeys = keyof UnifiedVideoParams extends UnifiedVideoParamKey ? true : never;
const _k1: _AssertKeysCoverParams = true;
const _k2: _AssertParamsCoverKeys = true;
void _k1;
void _k2;

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

/** clip 词汇 → 统一词汇。未设置的键一律不出现在结果里（不写 undefined 占位）。 */
export function toUnifiedVideoParams(clip: VideoGenerationClipParams): UnifiedVideoParams {
  const unified: UnifiedVideoParams = {};
  if (clip.duration !== undefined) unified.seconds = clip.duration;
  if (clip.resolution !== undefined) unified.resolution = clip.resolution;
  if (clip.ratio !== undefined) unified.ratio = clip.ratio;
  if (clip.generateAudio !== undefined) unified.generateAudio = clip.generateAudio;
  if (clip.watermark !== undefined) unified.watermark = clip.watermark;
  if (clip.returnLastFrame !== undefined) unified.returnLastFrame = clip.returnLastFrame;
  if (clip.seed !== undefined) unified.seed = clip.seed;
  return unified;
}
