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
  style?: string;
  n?: number;
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
  options: [
    { value: '1024x1024', label: '1024 x 1024' },
    { value: '1792x1024', label: '1792 x 1024 (横版)' },
    { value: '1024x1792', label: '1024 x 1792 (竖版)' },
    { value: '512x512', label: '512 x 512' },
    { value: '256x256', label: '256 x 256' },
  ],
  defaultValue: '1024x1024',
};

export const IMAGE_QUALITY_OPTIONS: SelectParamDef = {
  key: 'quality',
  label: '图片质量 Quality',
  options: [
    { value: 'standard', label: 'Standard' },
    { value: 'hd', label: 'HD' },
  ],
  defaultValue: 'standard',
};

export const IMAGE_STYLE_OPTIONS: SelectParamDef = {
  key: 'style',
  label: '图片风格 Style',
  options: [
    { value: 'vivid', label: 'Vivid' },
    { value: 'natural', label: 'Natural' },
  ],
  defaultValue: 'vivid',
};

export const IMAGE_SELECT_DEFS: SelectParamDef[] = [
  IMAGE_SIZE_OPTIONS,
  IMAGE_QUALITY_OPTIONS,
  IMAGE_STYLE_OPTIONS,
];

export const IMAGE_N_DEF: SliderParamDef = {
  key: 'n',
  label: '生成数量 N',
  min: 1,
  max: 4,
  step: 1,
  defaultValue: 1,
};

export function getDefaultChatParams(): ModelParamsConfig {
  const params: ModelParams = {};
  const enabled: Record<string, boolean> = {};
  for (const def of CHAT_PARAM_DEFS) {
    (params as any)[def.key] = def.defaultValue;
    enabled[def.key] = def.key === 'temperature';
  }
  return { params, enabled };
}

export function getDefaultImageParams(): ModelParamsConfig {
  const params: ModelParams = {};
  const enabled: Record<string, boolean> = {};
  for (const def of IMAGE_SELECT_DEFS) {
    (params as any)[def.key] = def.defaultValue;
    enabled[def.key] = true;
  }
  (params as any)[IMAGE_N_DEF.key] = IMAGE_N_DEF.defaultValue;
  enabled[IMAGE_N_DEF.key] = true;
  return { params, enabled };
}

export function getEffectiveParams(config: ModelParamsConfig): ModelParams {
  const result: ModelParams = {};
  for (const [key, value] of Object.entries(config.params)) {
    if (config.enabled[key]) {
      (result as any)[key] = value;
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
