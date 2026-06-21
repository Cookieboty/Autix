import { Injectable } from '@nestjs/common';
import {
  AgentKind,
  MessageRole,
  VideoGenStatus,
  VideoClipStatus,
  VideoProjectStatus,
  type Prisma,
} from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';
import {
  buildPageResult,
  buildUserGeneratedProjectsWhere,
  projectDetailInclude,
  resolveNextClipOrder,
  userGeneratedProjectsListInclude,
  type VideoTemplateClipCreateInput,
} from './video-project.helpers';

export type { VideoTemplateClipCreateInput } from './video-project.helpers';

@Injectable()
export class VideoProjectRepository {
  constructor(private readonly prisma: PrismaService) {}

  findLatestStoryboardOnlyProject(userId: string) {
    return this.prisma.video_projects.findFirst({
      where: {
        userId,
        clips: {
          some: {},
        },
        NOT: {
          clips: {
            some: {
              generations: {
                some: {},
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  findProjectConversationInfo(projectId: string) {
    return this.prisma.video_projects.findUnique({
      where: { id: projectId },
      select: { id: true, userId: true, title: true, conversationId: true },
    });
  }

  createVideoConversation(input: { userId: string; title: string }) {
    return this.prisma.conversations.create({
      data: {
        userId: input.userId,
        title: input.title,
        kind: AgentKind.video,
      },
    });
  }

  assignConversation(projectId: string, conversationId: string) {
    return this.prisma.video_projects.update({
      where: { id: projectId },
      data: { conversationId },
    });
  }

  createProject(data: Prisma.video_projectsUncheckedCreateInput) {
    return this.prisma.video_projects.create({ data });
  }

  findConversationForProjectCreation(conversationId: string) {
    return this.prisma.conversations.findUnique({
      where: { id: conversationId },
      select: { id: true, userId: true, kind: true, videoProject: { select: { id: true } } },
    });
  }

  updateConversationKind(conversationId: string, kind: AgentKind) {
    return this.prisma.conversations.update({
      where: { id: conversationId },
      data: { kind },
    });
  }

  findProjectDetail(id: string) {
    return this.prisma.video_projects.findUnique({
      where: { id },
      include: projectDetailInclude,
    });
  }

  findProjectShareDetail(id: string) {
    return this.prisma.video_projects.findUnique({
      where: { id },
      include: {
        clips: {
          orderBy: { order: 'asc' },
          include: {
            generations: {
              where: {
                status: VideoGenStatus.completed,
                videoUrl: { not: null },
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });
  }

  async findUserGeneratedProjects(userId: string, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const where = buildUserGeneratedProjectsWhere(userId);
    const [items, total] = await Promise.all([
      this.prisma.video_projects.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
        include: userGeneratedProjectsListInclude,
      }),
      this.prisma.video_projects.count({ where }),
    ]);
    return buildPageResult({ items, total, page, pageSize, skip });
  }

  findProject(id: string) {
    return this.prisma.video_projects.findUnique({ where: { id } });
  }

  updateProject(
    id: string,
    data: { title?: string; coverImage?: string },
  ) {
    return this.prisma.video_projects.update({ where: { id }, data });
  }

  deleteProject(id: string) {
    return this.prisma.video_projects.delete({ where: { id } });
  }

  async findNextClipOrder(projectId: string): Promise<number> {
    const aggregate = await this.prisma.video_clips.aggregate({
      where: { projectId },
      _max: { order: true },
    });
    return resolveNextClipOrder(aggregate);
  }

  createClip(data: Prisma.video_clipsUncheckedCreateInput) {
    return this.prisma.video_clips.create({ data });
  }

  findClip(clipId: string) {
    return this.prisma.video_clips.findUnique({ where: { id: clipId } });
  }

  findClipAtOrder(projectId: string, order: number) {
    return this.prisma.video_clips.findUnique({
      where: {
        projectId_order: { projectId, order },
      },
    });
  }

  findClipOrder(clipId: string) {
    return this.prisma.video_clips.findUnique({
      where: { id: clipId },
      select: { order: true },
    });
  }

  findNextChainedPendingClip(projectId: string, order: number) {
    return this.prisma.video_clips.findUnique({
      where: {
        projectId_order: {
          projectId,
          order: order + 1,
        },
      },
      select: { id: true, status: true, chainFromPrev: true },
    });
  }

  updateClip(
    clipId: string,
    data: Prisma.video_clipsUncheckedUpdateInput,
  ) {
    return this.prisma.video_clips.update({
      where: { id: clipId },
      data,
    });
  }

  deleteClip(clipId: string) {
    return this.prisma.video_clips.delete({ where: { id: clipId } });
  }

  findProjectClips(projectId: string) {
    return this.prisma.video_clips.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });
  }

  findProjectClipStatuses(projectId: string) {
    return this.prisma.video_clips.findMany({
      where: { projectId },
      select: { status: true },
    });
  }

  updateProjectStatus(projectId: string, status: VideoProjectStatus) {
    return this.prisma.video_projects.update({
      where: { id: projectId },
      data: { status },
    });
  }

  findClipCascadeAnchor(clipId: string) {
    return this.prisma.video_clips.findUnique({
      where: { id: clipId },
      select: { id: true, projectId: true, order: true },
    });
  }

  findPendingTailClips(projectId: string, afterOrder: number) {
    return this.prisma.video_clips.findMany({
      where: {
        projectId,
        order: { gt: afterOrder },
        status: VideoClipStatus.pending,
      },
      orderBy: { order: 'asc' },
      select: { id: true, order: true, chainFromPrev: true },
    });
  }

  markClipsFailed(clipIds: string[]) {
    return this.prisma.video_clips.updateMany({
      where: { id: { in: clipIds } },
      data: { status: VideoClipStatus.failed },
    });
  }

  async renumberProjectClips(projectId: string) {
    const remaining = await this.findProjectClips(projectId);
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].order !== i + 1) {
        await this.prisma.video_clips.update({
          where: { id: remaining[i].id },
          data: { order: i + 1 },
        });
      }
    }
  }

  findProjectClipIds(projectId: string) {
    return this.prisma.video_clips.findMany({
      where: { projectId },
      select: { id: true },
    });
  }

  async reorderClips(clipIds: string[]) {
    for (let i = 0; i < clipIds.length; i++) {
      await this.prisma.video_clips.update({
        where: { id: clipIds[i] },
        data: { order: i + 1 },
      });
    }
  }

  findClipWithProject(clipId: string) {
    return this.prisma.video_clips.findUnique({
      where: { id: clipId },
      include: { project: true },
    });
  }

  createClipMaterial(data: Prisma.video_clip_materialsUncheckedCreateInput) {
    return this.prisma.video_clip_materials.create({ data });
  }

  findMaterialWithProject(materialId: string) {
    return this.prisma.video_clip_materials.findUnique({
      where: { id: materialId },
      include: { clip: { include: { project: true } } },
    });
  }

  deleteClipMaterial(materialId: string) {
    return this.prisma.video_clip_materials.delete({ where: { id: materialId } });
  }

  findWorkflowTemplate(templateId: string) {
    return this.prisma.video_workflow_templates.findUnique({
      where: { id: templateId },
    });
  }

  async createStandaloneProjectFromWorkflowTemplate(input: {
    templateId: string;
    userId: string;
    title: string;
    coverImage: string | null;
    clips: VideoTemplateClipCreateInput[];
  }) {
    return this.prisma.$transaction(async (tx) => {
      const createdProject = await tx.video_projects.create({
        data: {
          userId: input.userId,
          title: input.title,
          coverImage: input.coverImage,
          status: VideoProjectStatus.draft,
        },
      });

      for (const clip of input.clips) {
        await tx.video_clips.create({
          data: {
            ...clip,
            projectId: createdProject.id,
          },
        });
      }

      await tx.video_workflow_templates.update({
        where: { id: input.templateId },
        data: { useCount: { increment: 1 } },
      });

      return createdProject;
    });
  }

  findVideoTemplate(templateId: string) {
    return this.prisma.video_templates.findUnique({
      where: { id: templateId },
    });
  }

  async createStandaloneProjectFromVideoTemplate(input: {
    templateId: string;
    userId: string;
    title: string;
    coverImage: string | null;
    clip: VideoTemplateClipCreateInput;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const createdProject = await tx.video_projects.create({
        data: {
          userId: input.userId,
          title: input.title,
          coverImage: input.coverImage,
          status: VideoProjectStatus.draft,
        },
      });

      await tx.video_clips.create({
        data: {
          ...input.clip,
          projectId: createdProject.id,
        },
      });

      await tx.video_templates.update({
        where: { id: input.templateId },
        data: { useCount: { increment: 1 } },
      });

      return createdProject;
    });
  }

  findProjectGenerations(projectId: string) {
    return this.prisma.video_clip_generations.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  updateClipParams(clipId: string, params: Prisma.InputJsonValue) {
    return this.prisma.video_clips.update({
      where: { id: clipId },
      data: { params },
    });
  }

  findConversationMessages(conversationId: string) {
    return this.prisma.messages.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });
  }

  findVideoDirectorProject(input: {
    conversationId?: string;
    projectId: string;
    userId: string;
  }) {
    return this.prisma.video_projects.findFirst({
      where: input.conversationId
        ? { conversationId: input.conversationId }
        : { id: input.projectId, userId: input.userId },
      include: {
        clips: { orderBy: { order: 'asc' }, include: { materials: true } },
      },
    });
  }

  persistVideoDirectorTurn(input: {
    conversationId: string;
    userMessage: string;
    assistantContent: string;
    modelConfigId?: string;
    metadata: Record<string, unknown>;
  }) {
    return this.prisma.$transaction([
      this.prisma.messages.create({
        data: {
          conversationId: input.conversationId,
          role: MessageRole.USER,
          content: input.userMessage,
          metadata: {
            messageType: 'markdown',
            source: 'video_director',
            modelConfigId: input.modelConfigId,
          },
        },
      }),
      this.prisma.messages.create({
        data: {
          conversationId: input.conversationId,
          role: MessageRole.ASSISTANT,
          content: input.assistantContent,
          metadata: {
            messageType: 'markdown',
            source: 'video_director',
            modelConfigId: input.modelConfigId,
            ...input.metadata,
          },
        },
      }),
    ]);
  }
}
