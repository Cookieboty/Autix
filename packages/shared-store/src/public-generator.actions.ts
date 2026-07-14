import {
  imageTemplateApi,
  pointsApi,
  publicImageGeneratorApi,
  videoProjectApi,
  type TaskEstimateInput,
  type TaskEstimateResult,
  type ImageTemplate,
  type PublicImageGenerateInput,
  type PublicImageGenerateResult,
  type PublicImageHistoryItem,
  type ImageGenerationGalleryPost,
} from '@autix/sdk';

export type {
  TaskEstimateInput,
  TaskEstimateResult,
  ImageTemplate,
} from '@autix/sdk';

export type {
  PublicImageGenerateInput,
  PublicImageGenerateResult,
  PublicImageHistoryItem,
  ImageGenerationGalleryPost,
};

export const publicGeneratorActions = {
  estimateGeneration: async (
    input: TaskEstimateInput,
  ): Promise<TaskEstimateResult> => {
    const res = await pointsApi.estimate(input);
    return res.data;
  },
  listImageTemplates: async (params?: {
    sort?: 'newest' | 'popular' | 'likes';
    page?: number;
    pageSize?: number;
  }): Promise<ImageTemplate[]> => {
    const res = await imageTemplateApi.list(params);
    return res.data.items ?? [];
  },
  listImageHistory: async (params?: {
    page?: number;
    pageSize?: number;
  }): Promise<PublicImageHistoryItem[]> => {
    const res = await publicImageGeneratorApi.history(params);
    return res.data.items ?? [];
  },
  /** DELETE /image-gen/workbench/history/:id：删除一整条生成记录（该次生成的全部图）。
   *  该生成若还有活着的广场帖，服务端返回 409。 */
  deleteImageHistory: async (id: string): Promise<void> => {
    await publicImageGeneratorApi.deleteHistory(id);
  },
  generateImage: async (
    input: PublicImageGenerateInput,
  ): Promise<PublicImageGenerateResult> => {
    const res = await publicImageGeneratorApi.generate(input);
    return res.data;
  },
  optimizeVideoPrompt: async (
    input: { prompt: string; modelId?: string },
  ): Promise<string> => {
    const res = await videoProjectApi.optimizePrompt(input);
    return res.data.optimizedPrompt;
  },
};
