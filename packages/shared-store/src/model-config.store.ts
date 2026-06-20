import { create } from 'zustand';
import {
  createModel,
  deleteModel,
  getAllModels,
  getAvailableModels,
  updateModel,
  type ModelConfigItem,
} from '@autix/sdk';
import {
  getModelCategory,
  hasChatCapability,
  hasImageCapability,
  isVideoModel,
  type ModelCategory,
  type ModelParams,
  type ModelParamsConfig,
} from '@autix/domain';

export type { ModelConfigItem } from '@autix/sdk';
export {
  getDefaultChatParams,
  getDefaultImageParams,
  getEffectiveParams,
  getModelCategory,
  hasChatCapability,
  hasImageCapability,
  isVideoModel,
  ALL_CATEGORIES,
  CATEGORY_LABELS,
  CHAT_PARAM_DEFS,
  IMAGE_N_DEF,
  IMAGE_SELECT_DEFS,
} from '@autix/domain';
export type { ModelCategory, ModelParams, ModelParamsConfig } from '@autix/domain';

export async function listAvailableModels(): Promise<ModelConfigItem[]> {
  const res = await getAvailableModels();
  return res.data as ModelConfigItem[];
}

export async function listAllModelConfigs(): Promise<ModelConfigItem[]> {
  const res = await getAllModels();
  return res.data as ModelConfigItem[];
}

export function createModelConfig(data: Record<string, unknown>) {
  return createModel(data);
}

export function updateModelConfig(id: string, data: Record<string, unknown>) {
  return updateModel(id, data);
}

export function deleteModelConfig(id: string) {
  return deleteModel(id);
}

interface ModelConfigState {
  availableModels: ModelConfigItem[];
  loading: boolean;
  loadAvailableModels: () => Promise<ModelConfigItem[]>;
  getVideoModels: () => ModelConfigItem[];
  getChatModels: () => ModelConfigItem[];
  getModelsByCategory: () => Record<ModelCategory, ModelConfigItem[]>;
}

export const useModelConfigStore = create<ModelConfigState>((set, get) => ({
  availableModels: [],
  loading: false,
  loadAvailableModels: async () => {
    set({ loading: true });
    try {
      const availableModels = await listAvailableModels();
      set({ availableModels, loading: false });
      return availableModels;
    } catch {
      set({ loading: false });
      return [];
    }
  },
  getVideoModels: () => get().availableModels.filter(isVideoModel),
  getChatModels: () =>
    get().availableModels.filter(
      (model) => hasChatCapability(model.capabilities ?? []) && !isVideoModel(model),
    ),
  getModelsByCategory: () => {
    const modelsByCategory: Record<ModelCategory, ModelConfigItem[]> = {
      multimodal: [],
      image: [],
    };
    for (const model of get().availableModels) {
      modelsByCategory[getModelCategory(model.capabilities ?? [])].push(model);
    }
    return modelsByCategory;
  },
}));
