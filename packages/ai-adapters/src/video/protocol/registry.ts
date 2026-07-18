import {
  arkVideoV3,
  poyoVeo,
  poyoWanT2V,
  poyoWanI2V,
  poyoWanRef,
  poyoWanEdit,
  poyoGrokImagine,
  poyoGrokV15,
  poyoHappyHorse,
  poyoHappyHorse11,
} from './presets/vendors';
import type { VideoProtocolPreset } from './types';

/**
 * 已注册的视频协议 preset。模型经 `metadata.protocolKey` 路由到这里。
 *
 * 不用 `provider` 做路由键：现网所有 model_configs.provider 都是 `amux`（网关名），
 * 拿它路由会把多家模型落到同一个 preset —— 正是 image 重构前的 bug 形态。
 */
export const VIDEO_PROTOCOL_PRESETS: Record<string, VideoProtocolPreset> = {
  [arkVideoV3.key]: arkVideoV3,
  [poyoVeo.key]: poyoVeo,
  [poyoWanT2V.key]: poyoWanT2V,
  [poyoWanI2V.key]: poyoWanI2V,
  [poyoWanRef.key]: poyoWanRef,
  [poyoWanEdit.key]: poyoWanEdit,
  [poyoGrokImagine.key]: poyoGrokImagine,
  [poyoGrokV15.key]: poyoGrokV15,
  [poyoHappyHorse.key]: poyoHappyHorse,
  [poyoHappyHorse11.key]: poyoHappyHorse11,
};

/**
 * 未注册的 key 直接抛 —— **不做静默 fallback**。
 * 老的 resolveImageAdapter 正是靠静默 fallback 把所有模型悄悄落到 openai-compatible，
 * 让手写的 adapter 变成死代码（image/protocol/registry.ts:26 记着这笔账）。
 */
export function resolveVideoPreset(protocolKey: string | undefined): VideoProtocolPreset {
  if (!protocolKey) {
    throw new Error('model metadata.protocolKey is missing — cannot route to a protocol preset');
  }
  const preset = VIDEO_PROTOCOL_PRESETS[protocolKey];
  if (!preset) {
    throw new Error(`No protocol preset registered for protocolKey "${protocolKey}"`);
  }
  return preset;
}
