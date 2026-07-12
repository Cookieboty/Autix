import { Injectable } from '@nestjs/common';
import {
  GrowthPageStatus,
  PublicCollectionKind,
  PublicCollectionStatus,
  TemplateStatus,
  type Prisma,
} from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';

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
        },
      },
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

  findCreatorProfile(handle: string) {
    return this.prisma.creator_profiles.findFirst({
      where: { handle, user: { status: { not: 'DELETED' } } },
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
      const profile = await tx.creator_profiles.findFirst({
        where: { handle, user: { status: { not: 'DELETED' } } },
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
