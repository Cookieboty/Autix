import {
  materialsApi,
  pointsApi,
  videoProjectApi,
  videoTemplateApi,
  type GenerationPricingEstimate,
  type GenerationPricingEstimateInput,
  type MaterialAsset,
  type MaterialAssetType,
  type MaterialCreateInput,
  type VideoTemplate,
  type VideoWorkflowTemplate,
} from '@autix/sdk';

export type {
  GenerationPricingEstimate,
  GenerationPricingEstimateInput,
  MaterialAsset,
  MaterialAssetType,
  VideoTemplate,
  VideoWorkflowTemplate,
} from '@autix/sdk';

export type WorkbenchVideoTemplate =
  | ({ templateKind: 'workflow'; templateKey: string } & VideoWorkflowTemplate)
  | ({ templateKind: 'standard'; templateKey: string } & VideoTemplate);

export async function loadWorkbenchVideoTemplates(): Promise<WorkbenchVideoTemplate[]> {
  const [workflowResult, standardResult] = await Promise.allSettled([
    videoProjectApi.listWorkflowTemplates({ pageSize: 50 }),
    videoTemplateApi.list({ sort: 'popular', pageSize: 50 }),
  ]);
  const workflowTemplates =
    workflowResult.status === 'fulfilled'
      ? (workflowResult.value.data.items ?? []).map((tpl) => ({
        ...tpl,
        templateKind: 'workflow' as const,
        templateKey: `workflow:${tpl.id}`,
      }))
      : [];
  const standardTemplates =
    standardResult.status === 'fulfilled'
      ? (standardResult.value.data.items ?? []).map((tpl) => ({
        ...tpl,
        templateKind: 'standard' as const,
        templateKey: `standard:${tpl.id}`,
      }))
      : [];
  return [...workflowTemplates, ...standardTemplates];
}

export const videoWorkbenchActions = {
  getAccountBalance: async (): Promise<number | null> => {
    const res = await pointsApi.getSummary();
    return res.data?.account?.availableBalance ?? res.data?.account?.balance ?? null;
  },
  estimateGeneration: async (
    input: GenerationPricingEstimateInput,
  ): Promise<GenerationPricingEstimate> => {
    const res = await pointsApi.estimate(input);
    return res.data;
  },
  getStandardTemplate: async (id: string): Promise<VideoTemplate> => {
    const res = await videoTemplateApi.getById(id);
    return res.data;
  },
  getWorkflowTemplate: async (id: string): Promise<VideoWorkflowTemplate> => {
    const res = await videoProjectApi.getWorkflowTemplate(id);
    return res.data;
  },
  directorChat: async (
    projectId: string,
    data: { message: string; modelId?: string },
  ): Promise<{ content: string }> => {
    const res = await videoProjectApi.directorChat(projectId, data);
    return res.data;
  },
  listMaterials: async (params?: {
    type?: MaterialAssetType | 'all';
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<MaterialAsset[]> => {
    const res = await materialsApi.list(params);
    return res.data.items ?? [];
  },
  useMaterial: async (id: string): Promise<MaterialAsset> => {
    const res = await materialsApi.use(id);
    return res.data;
  },
  createMaterial: async (data: MaterialCreateInput): Promise<MaterialAsset> => {
    const res = await materialsApi.create(data);
    return res.data;
  },
};
