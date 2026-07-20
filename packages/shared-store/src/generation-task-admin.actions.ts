import {
  generationTaskAdminApi,
  type GenerationTaskAdminDetail,
  type GenerationTaskAdminItem,
  type GenerationTaskAdminListParams,
  type GenerationTaskAdminListResult,
} from '@autix/sdk';

// 重新导出 SDK 类型：shared-ui 与 admin 页面被架构边界脚本禁止直接 import @autix/sdk，
// 只能从 shared-store 拿类型。
export type {
  GenerationTaskAdminDetail,
  GenerationTaskAdminItem,
  GenerationTaskAdminListParams,
  GenerationTaskAdminListResult,
};

export const generationTaskAdminActions = {
  async list(params: GenerationTaskAdminListParams): Promise<GenerationTaskAdminListResult> {
    const { data } = await generationTaskAdminApi.list(params);
    return data;
  },
  async detail(id: string): Promise<GenerationTaskAdminDetail> {
    const { data } = await generationTaskAdminApi.detail(id);
    return data;
  },
};
