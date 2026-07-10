import {
  materialsApi,
  pointsApi,
  uploadToPresignedUrl,
  videoProjectApi,
  videoTemplateApi,
  type TaskEstimateInput,
  type TaskEstimateResult,
  type MaterialAsset,
  type MaterialAssetType,
  type MaterialCreateInput,
  type VideoTemplate,
  type VideoWorkflowTemplate,
} from '@autix/sdk';

export type {
  TaskEstimateInput,
  TaskEstimateResult,
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
    input: TaskEstimateInput,
  ): Promise<TaskEstimateResult> => {
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
    data: {
      message: string;
      modelId?: string;
      billingPurpose?: 'video_template_optimize' | 'video_storyboard_optimize';
    },
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
  uploadScreenshotMaterial: async (input: {
    file: File;
    title: string;
    sourceId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<MaterialAsset> => {
    const contentType = input.file.type || 'image/png';
    const presign = await materialsApi.uploadUrl({
      fileName: input.file.name,
      contentType,
      folder: 'amux-studio/materials/video-snapshots',
    });
    const uploadRes = await uploadToPresignedUrl(presign.data.uploadUrl, input.file, {
      contentType,
    });
    if (!uploadRes.ok) throw new Error(input.file.name);
    const res = await materialsApi.create({
      type: 'image',
      title: input.title,
      url: presign.data.publicUrl,
      thumbnailUrl: presign.data.publicUrl,
      mimeType: contentType,
      size: input.file.size,
      storageKey: presign.data.key,
      sourceType: 'video_generation',
      sourceId: input.sourceId ?? null,
      tags: ['video-snapshot'],
      metadata: input.metadata ?? null,
    });
    return res.data;
  },
};
