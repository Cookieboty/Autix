import {
  doubaoImagesV1,
  geminiImagesV1,
  geminiGenerateContentV1,
  minimaxImagesV1,
  openaiImagesV1,
} from './presets/vendors';
import type { ProtocolPreset } from './types';

/**
 * 已注册的协议 preset。模型经 `metadata.protocolKey` 路由到这里。
 *
 * 四家共用同一套传输形态（OpenAI 兼容端点 / Bearer / `data[]` 响应），差异全在
 * body 字段——这正是 preset 机制存在的理由：把「统一参数 → 原生字段」的映射变成
 * **声明**，而不是散在三个手写 adapter 里的 if/else。
 */
export const PROTOCOL_PRESETS: Record<string, ProtocolPreset> = {
  [openaiImagesV1.key]: openaiImagesV1,
  [doubaoImagesV1.key]: doubaoImagesV1,
  [geminiImagesV1.key]: geminiImagesV1,
  [geminiGenerateContentV1.key]: geminiGenerateContentV1,
  [minimaxImagesV1.key]: minimaxImagesV1,
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
