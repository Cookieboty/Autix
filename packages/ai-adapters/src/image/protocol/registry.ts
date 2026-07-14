import { gatewayOpenAIV1 } from './presets/gateway-openai-v1';
import type { ProtocolPreset } from './types';

export const PROTOCOL_PRESETS: Record<string, ProtocolPreset> = {
  [gatewayOpenAIV1.key]: gatewayOpenAIV1,
};

/**
 * 未注册的 key 直接抛 —— **不做静默 fallback**。
 * 老的 resolveImageAdapter 正是靠静默 fallback 把所有模型悄悄落到 openai-compatible，
 * 让 GeminiImageAdapter / OpenAIImageAdapter 变成死代码（spec §2）。
 */
export function resolveImagePreset(protocolKey: string | undefined): ProtocolPreset {
  if (!protocolKey) {
    throw new Error('model metadata.protocolKey is missing — cannot route to a protocol preset');
  }
  const preset = PROTOCOL_PRESETS[protocolKey];
  if (!preset) {
    throw new Error(`No protocol preset registered for protocolKey "${protocolKey}"`);
  }
  return preset;
}
