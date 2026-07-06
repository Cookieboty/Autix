import { Injectable } from '@nestjs/common';
import { ResourceType, type Prisma } from '../platform/prisma/generated';
import { PrismaService } from '../platform/prisma/prisma.service';

interface CreateImageGenerationInput {
  id: string;
  templateId: string;
  userId: string;
  modelUsed: string;
  resolvedPrompt: string;
  variables: Prisma.InputJsonValue;
  referenceImage?: string;
}

type CreateVideoGenerationInput = CreateImageGenerationInput;

interface UpdateImageGenerationInput {
  generatedImages?: string[];
  status?: string;
  error?: string;
  durationMs?: number;
}

interface AddTurnInput {
  role: 'USER' | 'ASSISTANT';
  content: string;
  images?: string[];
}

type TemplateResourceType = Extract<
  ResourceType,
  'IMAGE_TEMPLATE' | 'VIDEO_TEMPLATE'
>;

@Injectable()
export class TemplateGenerationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createImageGeneration(input: CreateImageGenerationInput) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.image_generations.create({
        data: {
          id: input.id,
          templateId: input.templateId,
          userId: input.userId,
          modelUsed: input.modelUsed,
          resolvedPrompt: input.resolvedPrompt,
          variables: input.variables,
          referenceImage: input.referenceImage,
          status: 'pending',
        },
      });

      await tx.image_templates.update({
        where: { id: input.templateId },
        data: { useCount: { increment: 1 } },
      });

      return created;
    });
  }

  async createVideoGeneration(input: CreateVideoGenerationInput) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.video_generations.create({
        data: {
          id: input.id,
          templateId: input.templateId,
          userId: input.userId,
          modelUsed: input.modelUsed,
          resolvedPrompt: input.resolvedPrompt,
          variables: input.variables,
          referenceImage: input.referenceImage,
          status: 'pending',
        },
      });

      await tx.video_templates.update({
        where: { id: input.templateId },
        data: { useCount: { increment: 1 } },
      });

      return created;
    });
  }

  findImageGeneration(id: string) {
    return this.prisma.image_generations.findUnique({
      where: { id },
      include: { template: true },
    });
  }

  findVideoGeneration(id: string) {
    return this.prisma.video_generations.findUnique({
      where: { id },
      include: { template: true },
    });
  }

  findTurns(type: TemplateResourceType, id: string) {
    return this.prisma.generation_turns.findMany({
      where: {
        generationType: type,
        generationId: id,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  updateImageGeneration(id: string, data: UpdateImageGenerationInput) {
    return this.prisma.image_generations.update({ where: { id }, data });
  }

  addTurn(
    type: TemplateResourceType,
    generationId: string,
    data: AddTurnInput,
  ) {
    return this.prisma.generation_turns.create({
      data: {
        generationType: type,
        generationId,
        role: data.role,
        content: data.content,
        images: data.images ?? [],
      },
    });
  }

  async findImageGenerationsByUser(userId: string, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.prisma.image_generations.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          template: {
            select: { title: true, coverImage: true, category: true },
          },
        },
      }),
      this.prisma.image_generations.count({ where: { userId } }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      hasMore: skip + items.length < total,
    };
  }

  async findVideoGenerationsByUser(userId: string, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.prisma.video_generations.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          template: {
            select: { title: true, coverImage: true, category: true },
          },
        },
      }),
      this.prisma.video_generations.count({ where: { userId } }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      hasMore: skip + items.length < total,
    };
  }
}
