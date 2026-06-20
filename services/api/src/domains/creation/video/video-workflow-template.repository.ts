import { Injectable } from '@nestjs/common';
import {
  AgentKind,
  TemplateStatus,
  VideoProjectStatus,
  type Prisma,
} from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';
import type { VideoTemplateClipCreateInput } from './video-project.repository';

@Injectable()
export class VideoWorkflowTemplateRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(input: {
    category?: string;
    status: TemplateStatus;
    page: number;
    pageSize: number;
  }) {
    const skip = (input.page - 1) * input.pageSize;
    const where: Prisma.video_workflow_templatesWhereInput = {
      status: input.status,
    };
    if (input.category) where.category = input.category;

    const [items, total] = await Promise.all([
      this.prisma.video_workflow_templates.findMany({
        where,
        orderBy: { useCount: 'desc' },
        skip,
        take: input.pageSize,
      }),
      this.prisma.video_workflow_templates.count({ where }),
    ]);

    return {
      items,
      total,
      page: input.page,
      pageSize: input.pageSize,
      hasMore: skip + items.length < total,
    };
  }

  findById(id: string) {
    return this.prisma.video_workflow_templates.findUnique({
      where: { id },
    });
  }

  create(input: {
    authorId: string;
    title: string;
    description?: string;
    category: string;
    coverImage?: string;
    tags: string[];
    clips: Prisma.InputJsonValue;
    pointsCost: number;
  }) {
    return this.prisma.video_workflow_templates.create({
      data: {
        title: input.title,
        description: input.description,
        category: input.category,
        coverImage: input.coverImage,
        tags: input.tags,
        clips: input.clips,
        authorId: input.authorId,
        pointsCost: input.pointsCost,
        status: TemplateStatus.PENDING,
      },
    });
  }

  findConversationForProjectCreation(conversationId: string) {
    return this.prisma.conversations.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        userId: true,
        kind: true,
        videoProject: { select: { id: true } },
      },
    });
  }

  updateConversationKind(conversationId: string, kind: AgentKind) {
    return this.prisma.conversations.update({
      where: { id: conversationId },
      data: { kind },
    });
  }

  createVideoConversation(input: { userId: string; title: string }) {
    return this.prisma.conversations.create({
      data: { userId: input.userId, title: input.title, kind: AgentKind.video },
    });
  }

  async createProjectWithClipsFromTemplate(input: {
    templateId: string;
    userId: string;
    title: string;
    coverImage: string | null;
    conversationId: string;
    clips: VideoTemplateClipCreateInput[];
  }) {
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.video_projects.create({
        data: {
          userId: input.userId,
          title: input.title,
          coverImage: input.coverImage,
          conversationId: input.conversationId,
          status: VideoProjectStatus.draft,
        },
      });

      for (const clip of input.clips) {
        await tx.video_clips.create({
          data: {
            ...clip,
            projectId: project.id,
          },
        });
      }

      await tx.video_workflow_templates.update({
        where: { id: input.templateId },
        data: { useCount: { increment: 1 } },
      });

      return project;
    });
  }
}
