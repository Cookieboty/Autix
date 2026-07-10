import {
  campaignApi,
  imageTemplateApi,
  imageWorkbenchApi,
  materialsApi,
  pointsApi,
  type TaskEstimateInput,
  type TaskEstimateResult,
  type ImageTemplate,
  type ImageWorkbenchGenerateInput,
  type ImageWorkbenchGenerateResult,
  type ImageWorkbenchHistoryItem,
  type ImageWorkbenchMergeAnnotationInput,
  type ImageWorkbenchRefinePromptInput,
  type ImageWorkbenchRefinePromptResult,
  type MaterialAsset,
  type MaterialCreateInput,
} from '@autix/sdk';

export type {
  TaskEstimateInput,
  TaskEstimateResult,
  ImageTemplate,
  ImageWorkbenchGenerateInput,
  ImageWorkbenchGenerateResult,
  ImageWorkbenchHistoryItem,
  ImageWorkbenchMergeAnnotationInput,
  ImageWorkbenchRefinePromptInput,
  ImageWorkbenchRefinePromptResult,
  MaterialAsset,
  MaterialCreateInput,
} from '@autix/sdk';

export interface ImageFeedbackInput {
  generationId: string;
  rating: 1 | 5;
  metadata?: Record<string, unknown>;
}

export const imageWorkbenchActions = {
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
  listHistory: async (params?: {
    page?: number;
    pageSize?: number;
  }): Promise<ImageWorkbenchHistoryItem[]> => {
    const res = await imageWorkbenchApi.history(params);
    return res.data.items ?? [];
  },
  deleteHistory: (id: string) => imageWorkbenchApi.deleteHistory(id),
  generate: async (
    input: ImageWorkbenchGenerateInput,
  ): Promise<ImageWorkbenchGenerateResult> => {
    const res = await imageWorkbenchApi.generate(input);
    return res.data;
  },
  refinePrompt: async (
    input: ImageWorkbenchRefinePromptInput,
  ): Promise<ImageWorkbenchRefinePromptResult> => {
    const res = await imageWorkbenchApi.refinePrompt(input);
    return res.data;
  },
  mergeAnnotation: async (
    input: ImageWorkbenchMergeAnnotationInput,
  ): Promise<string> => {
    const res = await imageWorkbenchApi.mergeAnnotation(input);
    return res.data.image;
  },
  listTemplates: async (params?: {
    sort?: 'newest' | 'popular' | 'likes';
    page?: number;
    pageSize?: number;
  }): Promise<ImageTemplate[]> => {
    const res = await imageTemplateApi.list(params);
    return res.data.items ?? [];
  },
  getTemplate: async (id: string): Promise<ImageTemplate> => {
    const res = await imageTemplateApi.getById(id);
    return res.data;
  },
  listMaterials: async (params?: {
    type?: 'image' | 'video' | 'audio' | 'file' | 'all';
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
  deleteMaterial: (id: string) => materialsApi.remove(id),
  submitFeedback: async (input: ImageFeedbackInput): Promise<void> => {
    await campaignApi.submitFeedback({
      feedbackId: `image:${input.generationId}`,
      generationId: input.generationId,
      generationType: 'image',
      rating: input.rating,
      metadata: input.metadata,
    });
  },
};
