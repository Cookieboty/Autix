/**
 * Wan 2.7 是 PoYo 上的**一个**模型,但上游按工作流暴露 4 个 model ID(文/图/参考/编辑),
 * 且请求体字段各不同。合成后前端只有一个「Wan 2.7」,这里按用户提供的**素材角色**推断
 * 子模式,派发到对应的上游 model ID + protocolKey。
 *
 * 优先级:首/末帧(i2v) > 参考图/视频(ref) > 纯文本(t2v)。
 * edit 暂不纳入自动推断——它的源视频与 ref 的 reference_video 是同一个角色,从角色无法区分。
 *
 * 计费四模式统一(seed 的 wanPricing),故运行时按素材覆盖上游 model ID **不违反**
 * 「选便宜模型过鉴权、偷换成贵模型」的安全不变量(FIX-3):派发是服务端权威的,且价格恒等。
 */
export type WanMode = 't2v' | 'i2v' | 'ref';

export interface WanDispatch {
  mode: WanMode;
  /** 派发到的上游 model ID(写进请求体 body.model)。 */
  modelId: string;
  /** 派发到的 protocolKey(决定请求体字段路由的 preset)。 */
  protocolKey: string;
  /** 该模式上游支持的最长时长(秒):ref 只到 10,t2v/i2v 到 15。 */
  maxDurationSeconds: number;
}

const WAN_MODE_TABLE: Record<WanMode, Omit<WanDispatch, 'mode'>> = {
  i2v: { modelId: 'wan2.7-image-to-video', protocolKey: 'poyo-wan-i2v@v1', maxDurationSeconds: 15 },
  ref: { modelId: 'wan2.7-reference-to-video', protocolKey: 'poyo-wan-ref@v1', maxDurationSeconds: 10 },
  t2v: { modelId: 'wan2.7-text-to-video', protocolKey: 'poyo-wan-t2v@v1', maxDurationSeconds: 15 },
};

/** 素材角色 → Wan 子模式(+ 上游 model ID / protocolKey / 时长上限)。 */
export function resolveWanMode(materialRoles: readonly string[]): WanDispatch {
  const roles = new Set(materialRoles);
  const mode: WanMode =
    roles.has('first_frame') || roles.has('last_frame')
      ? 'i2v'
      : roles.has('reference_image') || roles.has('reference_video')
        ? 'ref'
        : 't2v';
  return { mode, ...WAN_MODE_TABLE[mode] };
}
