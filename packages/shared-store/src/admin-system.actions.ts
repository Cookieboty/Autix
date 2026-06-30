import {
  createSystemModel,
  deleteSystemModel,
  getSystemModels,
  systemPromptsApi,
  systemSettingsApi,
  updateSystemModel,
  membershipAdminApi,
  type ModelConfigItem,
  type MembershipLevel,
  type PublicSystemSettings,
  type SystemPromptInput,
  type SystemPromptItem,
  type SystemSettingCategory,
  type SystemSettingItem,
} from '@autix/sdk';

export type {
  ModelConfigItem,
  MembershipLevel,
  PublicSystemSettings,
  SystemPromptInput,
  SystemPromptItem,
  SystemSettingCategory,
  SystemSettingItem,
};

export type AdminSystemSettingValues = Record<string, string | boolean | undefined>;

export interface AdminSystemModelInput extends Record<string, unknown> {
  name: string;
  model: string;
  provider: string;
  type: string;
  priority: number;
  isDefault: boolean;
  isActive: boolean;
  capabilities: string[];
  allowedMembershipLevelIds?: string[];
  baseUrl?: string | undefined;
  apiKey?: string | undefined;
}

export type AdminSystemPromptInput = SystemPromptInput & { id?: string };

const toArray = <T>(data: T[] | unknown): T[] => (Array.isArray(data) ? data : []);

export const adminSystemActions = {
  listSettings: async () => {
    const { data } = await systemSettingsApi.getAdmin();
    return toArray<SystemSettingItem>(data);
  },
  updateSettings: async (values: AdminSystemSettingValues) => {
    const { data } = await systemSettingsApi.updateAdmin(values);
    return toArray<SystemSettingItem>(data);
  },

  listModels: async () => {
    const { data } = await getSystemModels();
    return toArray<ModelConfigItem>(data);
  },
  listMembershipLevels: async () => {
    const { data } = await membershipAdminApi.getLevels();
    return toArray<MembershipLevel>(data);
  },
  createModel: (data: AdminSystemModelInput) => createSystemModel(data),
  updateModel: (id: string, data: AdminSystemModelInput) =>
    updateSystemModel(id, data),
  deleteModel: (id: string) => deleteSystemModel(id),

  listPrompts: async () => {
    const { data } = await systemPromptsApi.list();
    return toArray<SystemPromptItem>(data);
  },
  createPrompt: (data: AdminSystemPromptInput) => systemPromptsApi.create(data),
  updatePrompt: (id: string, data: AdminSystemPromptInput) =>
    systemPromptsApi.update(id, data),
  publishPrompt: (id: string) => systemPromptsApi.publish(id),
};
