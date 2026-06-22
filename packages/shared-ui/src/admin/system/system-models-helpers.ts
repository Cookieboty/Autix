import type {
  AdminSystemModelInput,
  ModelConfigItem,
} from '@autix/shared-store';

export const DEFAULT_AMUX_API_URL = 'https://api.amux.ai';

export const CAPABILITY_OPTIONS = [
  { value: 'text', key: 'text' },
  { value: 'vision', key: 'vision' },
  { value: 'voice', key: 'voice' },
  { value: 'speech', key: 'speech' },
  { value: 'code', key: 'code' },
  { value: 'reasoning', key: 'reasoning' },
  { value: 'image', key: 'image' },
  { value: 'video', key: 'video' },
  { value: 'embedding', key: 'embedding' },
];

export const MODEL_TYPES = ['general', 'code', 'intent', 'embedding', 'video'];

export type SystemModelForm = {
  id?: string;
  name: string;
  model: string;
  provider: string;
  type: string;
  priority: number;
  isDefault: boolean;
  isActive: boolean;
  capabilities: string[];
  allowedMembershipLevelIds: string[];
  baseUrl: string;
  apiKey: string;
};

export function createEmptySystemModelForm(amuxHost: string): SystemModelForm {
  return {
    name: '',
    model: '',
    provider: 'amux',
    type: 'general',
    priority: 0,
    isDefault: false,
    isActive: true,
    capabilities: ['text'],
    allowedMembershipLevelIds: [],
    baseUrl: `${amuxHost.replace(/\/$/, '')}/v1`,
    apiKey: '',
  };
}

export function systemModelFormFromModel(model: ModelConfigItem): SystemModelForm {
  return {
    id: model.id,
    name: model.name,
    model: model.model,
    provider: model.provider,
    type: model.type,
    priority: model.priority,
    isDefault: model.isDefault,
    isActive: (model as { isActive?: boolean }).isActive ?? true,
    capabilities: model.capabilities,
    allowedMembershipLevelIds: (model.allowedMembershipLevels ?? [])
      .map((item) => item.levelId ?? item.level?.id)
      .filter((levelId): levelId is string => typeof levelId === 'string' && levelId.length > 0),
    baseUrl: model.baseUrl ?? model.metadata?.baseUrl ?? '',
    apiKey: model.apiKey ?? model.metadata?.apiKey ?? '',
  };
}

export function buildSystemModelPayload(form: SystemModelForm): AdminSystemModelInput {
  return {
    name: form.name.trim() || form.model.trim(),
    model: form.model.trim(),
    provider: form.provider.trim() || 'openai',
    type: form.type,
    priority: form.priority,
    isDefault: form.isDefault,
    isActive: form.isActive,
    capabilities: form.capabilities.length > 0 ? form.capabilities : ['text'],
    allowedMembershipLevelIds: form.allowedMembershipLevelIds,
    baseUrl: form.baseUrl.trim() || undefined,
    apiKey: form.apiKey.trim() || undefined,
  };
}

export function groupSystemModels(models: ModelConfigItem[]) {
  return models.reduce<Record<string, ModelConfigItem[]>>((acc, model) => {
    const key = model.type || 'general';
    acc[key] = acc[key] ?? [];
    acc[key].push(model);
    return acc;
  }, {});
}

export function readModelError(error: unknown, fallback: string) {
  const err = error as {
    response?: { data?: { message?: unknown; msg?: unknown } };
    message?: unknown;
  };
  const responseMessage = err?.response?.data?.message ?? err?.response?.data?.msg;
  if (typeof responseMessage === 'string') return responseMessage;
  return typeof err?.message === 'string' ? err.message : fallback;
}
