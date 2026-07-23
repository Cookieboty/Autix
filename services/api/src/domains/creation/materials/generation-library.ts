import type { Prisma } from '../../platform/prisma/generated';

/**
 * 生成内容 → 素材库（librarySource='GENERATION'）的行构造。
 *
 * 纯函数，不碰 Prisma client：生成流程在**自己的事务里**调用（见
 * LlmRepository.createCompletedImageGenerationResult），回填脚本也复用同一套映射，
 * 两条路径产出的行因此保证同构——避免"生成时写一种、回填写另一种"的漂移。
 *
 * 一次生成产出多张图（image_generations.generatedImages 是数组），每张图一条素材，
 * 故 sourceId 必须带下标，否则同一次生成的多张图会互相覆盖。
 */

/** 素材 title 是 VarChar(200)；prompt 往往远超，截断并留省略号。 */
const TITLE_MAX = 200;

export const GENERATION_SOURCE_SEPARATOR = '::';

/** sourceId = '<generationId>::<下标>'，与 partial unique index material_assets_generation_source_uniq 的键一致。 */
export function buildGenerationSourceId(generationId: string, index: number) {
  return `${generationId}${GENERATION_SOURCE_SEPARATOR}${index}`;
}

export function buildGenerationTitle(prompt: string, fallback: string) {
  const trimmed = prompt.trim().replace(/\s+/g, ' ');
  if (!trimmed) return fallback;
  return trimmed.length > TITLE_MAX ? `${trimmed.slice(0, TITLE_MAX - 1)}…` : trimmed;
}

export interface GenerationMaterialInput {
  userId: string;
  generationId: string;
  /** 生成产物 URL 列表：图片取 generatedImages，视频取 generatedVideos。 */
  urls: string[];
  prompt: string;
  kind: 'image' | 'video';
  /**
   * 视频封面。图片素材的封面就是自身，无需传；视频没有自带缩略图，
   * 不传则 thumbnailUrl 落 NULL，素材库/选择面板将没有封面可渲染。
   */
  thumbnailUrl?: string | null;
  createdAt?: Date;
  /** 落进 metadata 供详情页展示（model / 尺寸等），不参与检索。 */
  metadata?: Prisma.InputJsonValue;
}

/**
 * 构造 material_assets.createMany 的 data。调用方务必配 skipDuplicates:true
 * —— 生成重试与回填重跑都靠 partial unique index + skipDuplicates 保证幂等。
 */
export function buildGenerationMaterialRows(
  input: GenerationMaterialInput,
): Prisma.material_assetsCreateManyInput[] {
  const fallbackTitle = input.kind === 'image' ? 'Generated image' : 'Generated video';
  return input.urls
    .map((url, index) => ({ url, index }))
    // 生成流水里可能混入空串/undefined（部分产图失败），这些不该进素材库。
    .filter((entry): entry is { url: string; index: number } => Boolean(entry.url))
    .map(({ url, index }) => ({
      userId: input.userId,
      type: input.kind,
      title: buildGenerationTitle(input.prompt, fallbackTitle),
      url,
      thumbnailUrl: input.kind === 'image' ? url : input.thumbnailUrl ?? null,
      sourceType: input.kind === 'image' ? 'image_generation' : 'video_generation',
      librarySource: 'GENERATION' as const,
      // 生成素材没有对应的市场 ResourceType——sourceId 指向生成流水行而非市场资源，
      // 故此列留 NULL，去重改由 partial unique index 承担。
      sourceResourceType: null,
      sourceId: buildGenerationSourceId(input.generationId, index),
      tags: [],
      folderId: null,
      ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    }));
}
