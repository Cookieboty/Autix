import { IMAGE_MODEL_CAPABILITIES } from '../image/capabilities';

export interface ChatModelParams {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export interface ImageGenModelParams {
  size?: string;
  quality?: string;
}

export type ModelParams = ChatModelParams & ImageGenModelParams;

export interface ModelParamsConfig {
  params: ModelParams;
  enabled: Record<string, boolean>;
}

export interface SliderParamDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

export interface SelectParamDef {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue: string;
}

export const CHAT_PARAM_DEFS: SliderParamDef[] = [
  { key: 'temperature', label: 'Temperature', min: 0, max: 2, step: 0.1, defaultValue: 0.7 },
  { key: 'topP', label: 'Top P', min: 0, max: 1, step: 0.05, defaultValue: 1 },
  { key: 'maxTokens', label: 'Max Tokens', min: 1, max: 128000, step: 1, defaultValue: 4096 },
  { key: 'frequencyPenalty', label: 'Frequency Penalty', min: -2, max: 2, step: 0.1, defaultValue: 0 },
  { key: 'presencePenalty', label: 'Presence Penalty', min: -2, max: 2, step: 0.1, defaultValue: 0 },
];

export const IMAGE_SIZE_OPTIONS: SelectParamDef = {
  key: 'size',
  label: '图片尺寸 Size',
  options: IMAGE_MODEL_CAPABILITIES['gpt-image'].sizes,
  defaultValue: IMAGE_MODEL_CAPABILITIES['gpt-image'].defaults.size,
};

export const IMAGE_QUALITY_OPTIONS: SelectParamDef = {
  key: 'quality',
  label: '图片质量 Quality',
  // capability.qualities 现在只存 value token；这里补上 label=value 作为中性占位，
  // 真正的本地化显示名由 UI 层用 i18n(pricing.options.<value>) 翻译。
  options: IMAGE_MODEL_CAPABILITIES['gpt-image'].qualities.map((value) => ({ value, label: value })),
  defaultValue: IMAGE_MODEL_CAPABILITIES['gpt-image'].defaults.quality,
};

export const IMAGE_SELECT_DEFS: SelectParamDef[] = [
  IMAGE_SIZE_OPTIONS,
  IMAGE_QUALITY_OPTIONS,
];

export function getDefaultChatParams(): ModelParamsConfig {
  const params: ModelParams = {};
  const enabled: Record<string, boolean> = {};
  for (const def of CHAT_PARAM_DEFS) {
    (params as Record<string, unknown>)[def.key] = def.defaultValue;
    enabled[def.key] = def.key === 'temperature';
  }
  return { params, enabled };
}

export function getDefaultImageParams(): ModelParamsConfig {
  const params: ModelParams = {};
  const enabled: Record<string, boolean> = {};
  for (const def of IMAGE_SELECT_DEFS) {
    (params as Record<string, unknown>)[def.key] = def.defaultValue;
    enabled[def.key] = true;
  }
  return { params, enabled };
}

export function getEffectiveParams(config: ModelParamsConfig): ModelParams {
  const result: ModelParams = {};
  for (const [key, value] of Object.entries(config.params)) {
    if (config.enabled[key]) {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result;
}

export function hasImageCapability(capabilities: string[]): boolean {
  return capabilities.includes('image');
}

export function hasChatCapability(capabilities: string[]): boolean {
  return (
    capabilities.includes('text') ||
    capabilities.includes('vision') ||
    capabilities.includes('code') ||
    capabilities.includes('reasoning') ||
    capabilities.length === 0
  );
}
