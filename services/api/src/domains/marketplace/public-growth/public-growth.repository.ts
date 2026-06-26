import { Injectable } from '@nestjs/common';
import {
  GrowthPageStatus,
  PublicCollectionKind,
  PublicCollectionStatus,
  PublicCreationMediaType,
  PublicCreationSourceType,
  PublicCreationStatus,
  TemplateStatus,
  VideoGenStatus,
  type Prisma,
} from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';

const liveCreationStatuses: PublicCreationStatus[] = [
  PublicCreationStatus.PUBLISHED,
  PublicCreationStatus.APPROVED,
];

const creationAuthorSelect = {
  id: true,
  username: true,
  realName: true,
  avatar: true,
  creatorProfile: {
    select: {
      handle: true,
      displayName: true,
      avatar: true,
      bio: true,
      followerCount: true,
    },
  },
} satisfies Prisma.UserSelect;

const publicCreationInclude = {
  user: { select: creationAuthorSelect },
} satisfies Prisma.public_creationsInclude;

@Injectable()
export class PublicGrowthRepository {
  constructor(private readonly prisma: PrismaService) {}

  findHomeSections() {
    return this.prisma.home_sections.findMany({
      where: { isActive: true },
      orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
      include: {
        items: {
          orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
          include: {
            creation: {
              include: publicCreationInclude,
            },
          },
        },
      },
    });
  }

  findFeaturedPublicCreations(take: number) {
    return this.prisma.public_creations.findMany({
      where: { status: { in: liveCreationStatuses } },
      orderBy: [
        { publishedAt: 'desc' },
        { viewCount: 'desc' },
      ],
      take,
      include: publicCreationInclude,
    });
  }

  findApprovedTemplateCards(take: number) {
    return Promise.all([
      this.prisma.image_templates.findMany({
        where: {
          status: TemplateStatus.APPROVED,
          OR: [
            { externalId: null },
            { externalId: { not: 'system:image-workbench' } },
          ],
        },
        orderBy: [
          { isHot: 'desc' },
          { useCount: 'desc' },
          { createdAt: 'desc' },
        ],
        take,
      }),
      this.prisma.video_templates.findMany({
        where: { status: TemplateStatus.APPROVED },
        orderBy: [
          { isHot: 'desc' },
          { useCount: 'desc' },
          { createdAt: 'desc' },
        ],
        take,
      }),
    ]).then(([imageTemplates, videoTemplates]) => ({
      imageTemplates,
      videoTemplates,
    }));
  }

  findGrowthPage(slug: string) {
    return this.prisma.growth_pages.findFirst({
      where: {
        slug,
        status: GrowthPageStatus.PUBLISHED,
      },
    });
  }

  listCollections(kind?: PublicCollectionKind) {
    return this.prisma.public_collections.findMany({
      where: {
        status: PublicCollectionStatus.PUBLISHED,
        kind,
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  findCollection(slug: string) {
    return this.prisma.public_collections.findFirst({
      where: {
        slug,
        status: PublicCollectionStatus.PUBLISHED,
      },
    });
  }

  async listCreations(input: {
    page: number;
    pageSize: number;
    mediaType?: PublicCreationMediaType;
    tag?: string;
    collectionSlug?: string;
    userId?: string;
  }) {
    const skip = (input.page - 1) * input.pageSize;
    const where: Prisma.public_creationsWhereInput = {
      status: { in: liveCreationStatuses },
      mediaType: input.mediaType,
      collectionSlug: input.collectionSlug,
      userId: input.userId,
      ...(input.tag ? { tags: { has: input.tag } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.public_creations.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }],
        skip,
        take: input.pageSize,
        include: publicCreationInclude,
      }),
      this.prisma.public_creations.count({ where }),
    ]);

    return {
      items,
      total,
      page: input.page,
      pageSize: input.pageSize,
      hasMore: skip + items.length < total,
    };
  }

  findCreation(id: string) {
    return this.prisma.public_creations.findFirst({
      where: {
        id,
        status: { in: liveCreationStatuses },
      },
      include: publicCreationInclude,
    });
  }

  incrementCreationCounter(id: string, field: 'viewCount' | 'shareCount') {
    return this.prisma.public_creations.update({
      where: { id },
      data: { [field]: { increment: 1 } },
    });
  }

  async likeCreation(id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      try {
        await tx.public_creation_likes.create({
          data: { creationId: id, userId },
        });
        return tx.public_creations.update({
          where: { id },
          data: { likeCount: { increment: 1 } },
        });
      } catch (error) {
        const code = typeof error === 'object' && error && 'code' in error
          ? (error as { code?: unknown }).code
          : null;
        if (code !== 'P2002') throw error;
        return tx.public_creations.findUniqueOrThrow({ where: { id } });
      }
    });
  }

  findImageGenerationForPublish(id: string) {
    return this.prisma.image_generations.findUnique({
      where: { id },
      include: {
        template: {
          select: {
            id: true,
            title: true,
            coverImage: true,
            category: true,
            tags: true,
          },
        },
      },
    });
  }

  findVideoProjectForPublish(id: string) {
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

  upsertPublicCreation(input: Prisma.public_creationsUncheckedCreateInput) {
    const now = new Date();
    return this.prisma.public_creations.upsert({
      where: {
        sourceType_sourceId: {
          sourceType: input.sourceType,
          sourceId: input.sourceId,
        },
      },
      create: input,
      update: {
        mediaType: input.mediaType,
        mediaUrl: input.mediaUrl,
        posterUrl: input.posterUrl,
        title: input.title,
        description: input.description,
        promptVisibility: input.promptVisibility,
        promptSnapshot: input.promptSnapshot,
        modelUsed: input.modelUsed,
        templateId: input.templateId,
        status: input.status,
        tags: input.tags,
        collectionSlug: input.collectionSlug,
        publishedAt: now,
      },
      include: publicCreationInclude,
    });
  }

  async ensureCreatorProfile(userId: string) {
    const existing = await this.prisma.creator_profiles.findUnique({
      where: { userId },
    });
    if (existing) return existing;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        realName: true,
        avatar: true,
      },
    });
    if (!user) return null;

    const baseHandle = normalizeHandle(user.username || user.email.split('@')[0] || 'creator');
    const displayName = user.realName || user.username || 'Amux Studio Creator';

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const handle = attempt === 0 ? baseHandle : `${baseHandle}-${user.id.slice(0, 4 + attempt)}`;
      try {
        return await this.prisma.creator_profiles.create({
          data: {
            userId,
            handle,
            displayName,
            avatar: user.avatar,
          },
        });
      } catch (error) {
        const code = typeof error === 'object' && error && 'code' in error
          ? (error as { code?: unknown }).code
          : null;
        if (code !== 'P2002') throw error;
      }
    }

    return this.prisma.creator_profiles.create({
      data: {
        userId,
        handle: `${baseHandle}-${Date.now().toString(36)}`,
        displayName,
        avatar: user.avatar,
      },
    });
  }

  findCreatorProfile(handle: string) {
    return this.prisma.creator_profiles.findUnique({
      where: { handle },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            realName: true,
            avatar: true,
          },
        },
      },
    });
  }

  async followCreator(handle: string, followerId: string) {
    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.creator_profiles.findUnique({
        where: { handle },
      });
      if (!profile) return null;
      if (profile.userId === followerId) return profile;

      try {
        await tx.creator_follows.create({
          data: { followerId, creatorUserId: profile.userId },
        });
        await tx.creator_profiles.update({
          where: { userId: profile.userId },
          data: { followerCount: { increment: 1 } },
        });
        await tx.creator_profiles.updateMany({
          where: { userId: followerId },
          data: { followingCount: { increment: 1 } },
        });
      } catch (error) {
        const code = typeof error === 'object' && error && 'code' in error
          ? (error as { code?: unknown }).code
          : null;
        if (code !== 'P2002') throw error;
      }

      return tx.creator_profiles.findUnique({ where: { handle } });
    });
  }

  createEvent(input: {
    eventName: string;
    path: string;
    userId?: string;
    anonymousId?: string;
    source?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.prisma.growth_events.create({ data: input });
  }
}

export function normalizeHandle(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return normalized || 'creator';
}

export function isLivePublicCreationStatus(status: PublicCreationStatus) {
  return liveCreationStatuses.includes(status);
}

export { PublicCreationSourceType };
