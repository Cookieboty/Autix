import { Injectable, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { VideoProjectStatus, VideoClipStatus, AgentKind } from '../prisma/generated';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateProjectDto {
  title: string;
  coverImage?: string;
  conversationId?: string;
}

export interface AddClipDto {
  title?: string;
  prompt?: string;
  params: Record<string, unknown>;
  chainFromPrev?: boolean;
}

export interface UpdateClipDto {
  title?: string;
  prompt?: string;
  params?: Record<string, unknown>;
  chainFromPrev?: boolean;
}

export interface AddMaterialDto {
  role: 'first_frame' | 'last_frame' | 'reference_image' | 'reference_video' | 'reference_audio';
  sourceType: 'upload' | 'image_generation' | 'video_generation' | 'platform_asset';
  sourceId?: string;
  url: string;
  name?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class VideoProjectService {
  constructor(private readonly prisma: PrismaService) { }

  async createProject(userId: string, dto: CreateProjectDto) {
    // Plan-8: video_project 必挂 conversation；支持复用已有 conversation（须为 video kind 且 owner 一致），否则建一条 kind=video 的新 conversation
    let conversationId: string;

    if (dto.conversationId) {
      const conv = await this.prisma.conversations.findUnique({
        where: { id: dto.conversationId },
        select: { id: true, userId: true, kind: true, videoProject: { select: { id: true } } },
      });
      if (!conv) throw new NotFoundException('会话不存在');
      if (conv.userId !== userId) throw new ForbiddenException('无权操作此会话');
      if (conv.videoProject)
        throw new BadRequestException('该会话已绑定视频项目');

      // 兼容老 chat 会话「升级」为 video：仅在当前 kind=chat 且未挂载项目时允许切换
      if (conv.kind !== AgentKind.video) {
        if (conv.kind !== AgentKind.chat) {
          throw new BadRequestException(
            `会话 kind=${conv.kind}，无法用于创建视频项目`,
          );
        }
        await this.prisma.conversations.update({
          where: { id: conv.id },
          data: { kind: AgentKind.video },
        });
      }
      conversationId = conv.id;
    } else {
      const conversation = await this.prisma.conversations.create({
        data: {
          userId,
          title: dto.title,
          kind: AgentKind.video,
        },
      });
      conversationId = conversation.id;
    }

    const project = await this.prisma.video_projects.create({
      data: {
        userId,
        title: dto.title,
        coverImage: dto.coverImage,
        conversationId,
        status: VideoProjectStatus.draft,
      },
    });

    return project;
  }

  async getProject(id: string, userId: string) {
    const project = await this.prisma.video_projects.findUnique({
      where: { id },
      include: {
        clips: {
          orderBy: { order: 'asc' },
          include: {
            materials: true,
            generations: {
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
          },
        },
      },
    });
    if (!project) throw new ForbiddenException('项目不存在');
    if (project.userId !== userId) throw new ForbiddenException('无权访问');
    return project;
  }

  async getUserProjects(userId: string, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.prisma.video_projects.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          clips: {
            orderBy: { order: 'asc' },
            take: 1,
            include: {
              generations: {
                where: { status: 'completed' },
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: { thumbnailUrl: true, videoUrl: true, variantLabel: true },
              },
            },
          },
        },
      }),
      this.prisma.video_projects.count({ where: { userId } }),
    ]);
    return { items, total, page, pageSize, hasMore: skip + items.length < total };
  }

  async updateProject(id: string, userId: string, data: { title?: string; coverImage?: string }) {
    const project = await this.prisma.video_projects.findUnique({ where: { id } });
    if (!project) throw new ForbiddenException('项目不存在');
    if (project.userId !== userId) throw new ForbiddenException('无权修改');

    return this.prisma.video_projects.update({ where: { id }, data });
  }

  async deleteProject(id: string, userId: string) {
    const project = await this.prisma.video_projects.findUnique({ where: { id } });
    if (!project) throw new ForbiddenException('项目不存在');
    if (project.userId !== userId) throw new ForbiddenException('无权删除');

    await this.prisma.video_projects.delete({ where: { id } });
  }

  async addClip(projectId: string, userId: string, dto: AddClipDto) {
    const project = await this.prisma.video_projects.findUnique({ where: { id: projectId } });
    if (!project || project.userId !== userId) throw new ForbiddenException('无权操作');

    const maxOrder = await this.prisma.video_clips
      .aggregate({ where: { projectId }, _max: { order: true } })
      .then((r) => r._max.order ?? 0);

    return this.prisma.video_clips.create({
      data: {
        projectId,
        order: maxOrder + 1,
        title: dto.title,
        prompt: dto.prompt,
        params: dto.params as object,
        chainFromPrev: dto.chainFromPrev ?? false,
        status: VideoClipStatus.pending,
      },
    });
  }

  async updateClip(projectId: string, clipId: string, userId: string, dto: UpdateClipDto) {
    const project = await this.prisma.video_projects.findUnique({ where: { id: projectId } });
    if (!project || project.userId !== userId) throw new ForbiddenException('无权操作');

    return this.prisma.video_clips.update({
      where: { id: clipId },
      data: {
        title: dto.title,
        prompt: dto.prompt,
        params: dto.params as object | undefined,
        chainFromPrev: dto.chainFromPrev,
      },
    });
  }

  async deleteClip(projectId: string, clipId: string, userId: string) {
    const project = await this.prisma.video_projects.findUnique({ where: { id: projectId } });
    if (!project || project.userId !== userId) throw new ForbiddenException('无权操作');

    const clip = await this.prisma.video_clips.findUnique({ where: { id: clipId } });
    if (!clip || clip.projectId !== projectId)
      throw new BadRequestException('Clip 不属于此项目');

    await this.prisma.video_clips.delete({ where: { id: clipId } });

    const remaining = await this.prisma.video_clips.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].order !== i + 1) {
        await this.prisma.video_clips.update({
          where: { id: remaining[i].id },
          data: { order: i + 1 },
        });
      }
    }
  }

  async reorderClips(projectId: string, userId: string, clipIds: string[]) {
    const project = await this.prisma.video_projects.findUnique({ where: { id: projectId } });
    if (!project || project.userId !== userId) throw new ForbiddenException('无权操作');

    for (let i = 0; i < clipIds.length; i++) {
      await this.prisma.video_clips.update({
        where: { id: clipIds[i] },
        data: { order: i + 1 },
      });
    }
  }

  async addMaterial(clipId: string, userId: string, dto: AddMaterialDto) {
    const clip = await this.prisma.video_clips.findUnique({
      where: { id: clipId },
      include: { project: true },
    });
    if (!clip || clip.project.userId !== userId)
      throw new ForbiddenException('无权操作');

    return this.prisma.video_clip_materials.create({
      data: {
        clipId,
        role: dto.role,
        sourceType: dto.sourceType,
        sourceId: dto.sourceId,
        url: dto.url,
        name: dto.name,
        metadata: dto.metadata as object | undefined,
      },
    });
  }

  async removeMaterial(materialId: string, userId: string) {
    const material = await this.prisma.video_clip_materials.findUnique({
      where: { id: materialId },
      include: { clip: { include: { project: true } } },
    });
    if (!material || material.clip.project.userId !== userId)
      throw new ForbiddenException('无权操作');

    await this.prisma.video_clip_materials.delete({ where: { id: materialId } });
  }

  async getProjectGenerations(projectId: string, userId: string) {
    const project = await this.prisma.video_projects.findUnique({ where: { id: projectId } });
    if (!project || project.userId !== userId) throw new ForbiddenException('无权访问');

    return this.prisma.video_clip_generations.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
