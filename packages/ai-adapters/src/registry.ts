import { PROTOCOL_PRESETS } from './image/protocol/registry';
import type { ProtocolPreset } from './image/protocol/types';
import { VIDEO_PROTOCOL_PRESETS } from './video/protocol/registry';
import type { VideoProtocolPreset } from './video/protocol/types';

export type AnyPresetEntry =
  | { media: 'image'; preset: ProtocolPreset }
  | { media: 'video'; preset: VideoProtocolPreset };

/**
 * protocolKey 自描述媒体 —— 模型保存时不必再猜「该用哪个 registry 校验」。
 *
 * 为什么不用 type/capabilities 分派：已核实 seed 数据，图片与文本模型的 `type` 同为
 * `general`（只有 capabilities 区分），两者都是可被误配的自由字段。用它们做协议分派
 * 是把正确性押在数据卫生上。preset key 本就已命名空间化，让 key 自己带媒体信息更可靠。
 *
 * key 冲突会导致静默误路由，由 registry.spec.ts 的断言挡住（对象 spread 不报错）。
 */
function findEntry(protocolKey: string): AnyPresetEntry | undefined {
  const image = PROTOCOL_PRESETS[protocolKey];
  if (image) return { media: 'image', preset: image };
  const video = VIDEO_PROTOCOL_PRESETS[protocolKey];
  if (video) return { media: 'video', preset: video };
  return undefined;
}

/**
 * 保存期用：未知 key 返回 undefined，交由调用方产出 violation（400）。
 *
 * **不要在保存期用 resolveAnyPreset** —— 它抛的普通 Error 会绕过
 * assertProtocolConfigIsClosed 的 violation 流程，把一个本该是 400 的用户配置错误变成 500。
 */
export function tryResolveAnyPreset(protocolKey: string): AnyPresetEntry | undefined {
  return findEntry(protocolKey);
}

/** 运行期用：未知 key 抛错（fail-loud，不静默 fallback）。 */
export function resolveAnyPreset(protocolKey: string): AnyPresetEntry {
  const entry = findEntry(protocolKey);
  if (!entry) throw new Error(`unknown protocolKey "${protocolKey}"`);
  return entry;
}
