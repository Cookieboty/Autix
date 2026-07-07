import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  PublicCollectionKind,
  PublicCreationMediaType,
  type Prisma,
} from '../../platform/prisma/generated';
import {
  type PublicGrowthFallbackBundle,
  getPublicGrowthFallbacks,
} from './public-growth.fallbacks';
import { PublicGrowthRepository, normalizeHandle } from './public-growth.repository';
import type {
  PublicGrowthCollection,
  PublicGrowthHome,
  PublicGrowthHomeSection,
  PublicGrowthMediaItem,
  PublicGrowthPage,
} from './public-growth.types';

type HomeSectionRow = Awaited<ReturnType<PublicGrowthRepository['findHomeSections']>>[number];
type CollectionRow = NonNullable<Awaited<ReturnType<PublicGrowthRepository['findCollection']>>>;

@Injectable()
export class PublicGrowthService {
  constructor(private readonly repository: PublicGrowthRepository) {}

  async getHome(locale?: string): Promise<PublicGrowthHome> {
    const fallbacks = getPublicGrowthFallbacks(locale);
    const [sections, templateCards, collections] = await Promise.all([
      this.repository.findHomeSections(),
      this.repository.findApprovedTemplateCards(8),
      this.repository.listCollections(PublicCollectionKind.COMMUNITY),
    ]);

    const mediaFromTemplates = this.templatesToMediaItems(templateCards, fallbacks);
    const mediaRail = [...mediaFromTemplates, ...fallbacks.mediaItems].slice(0, 18);
    const mappedSections = sections
      .map((section) => this.toHomeSection(section))
      .filter((section) => section.items.length > 0);

    return {
      promo: {
        label: fallbacks.homePromo,
        href: '/pricing',
      },
      mediaRail,
      featureMatrix: fallbacks.features,
      banner: fallbacks.homeBanner,
      masonryItems: mediaRail.slice(0, 24),
      tagRail: fallbacks.tagRail,
      sections: mappedSections,
      collections: collections.length
        ? collections.map((collection) => this.toCollection(collection))
        : fallbacks.collections,
    };
  }

  async getPage(slug: string, locale?: string): Promise<PublicGrowthPage> {
    const fallbacks = getPublicGrowthFallbacks(locale);
    const page = await this.repository.findGrowthPage(slug);
    if (!page) {
      const fallback = fallbacks.growthPages.find((item) => item.slug === slug);
      if (!fallback) throw new NotFoundException('公开页面不存在');
      return fallback;
    }

    const config = this.asRecord(page.config);
    return {
      slug: page.slug,
      title: page.title,
      description: page.description ?? '',
      heroMedia: page.heroMedia ?? fallbacks.mediaItems[0].mediaUrl,
      eyebrow: this.asString(config.eyebrow),
      ctaHref: this.asString(config.ctaHref) ?? '/ai/image',
      ctaLabel: this.asString(config.ctaLabel) ?? fallbacks.labels.startCreating,
      tags: this.asStringArray(config.tags),
      sections: this.asGrowthPageSections(config.sections),
    };
  }

  async listCollections(kind?: PublicCollectionKind, locale?: string) {
    const fallbacks = getPublicGrowthFallbacks(locale);
    const collections = await this.repository.listCollections(kind);
    if (collections.length) return collections.map((item) => this.toCollection(item));
    return fallbacks.collections.filter((item) => !kind || item.kind === kind);
  }

  async getCollection(slug: string, locale?: string) {
    const fallbacks = getPublicGrowthFallbacks(locale);
    const collection = await this.repository.findCollection(slug);
    const fallback = fallbacks.collections.find((item) => item.slug === slug);
    if (!collection && !fallback) throw new NotFoundException('集合不存在');

    const mappedCollection = collection ? this.toCollection(collection) : fallback!;
    const fallbackItems = fallbacks.mediaItems.filter((item) =>
      item.tags.some((tag) => mappedCollection.tags.includes(tag)),
    );
    return {
      collection: mappedCollection,
      items: fallbackItems.length ? fallbackItems : fallbacks.mediaItems,
    };
  }

  async getCreator(handle: string) {
    const profile = await this.repository.findCreatorProfile(normalizeHandle(handle));
    if (!profile) throw new NotFoundException('创作者不存在');
    return {
      profile: {
        userId: profile.userId,
        handle: profile.handle,
        displayName: profile.displayName,
        avatar: profile.avatar ?? profile.user.avatar,
        bio: profile.bio,
        followerCount: profile.followerCount,
        followingCount: profile.followingCount,
        externalLinks: profile.externalLinks,
      },
    };
  }

  async followCreator(handle: string, followerId: string) {
    const profile = await this.repository.followCreator(normalizeHandle(handle), followerId);
    if (!profile) throw new NotFoundException('创作者不存在');
    return { followed: true, followerCount: profile.followerCount };
  }

  async recordEvent(input: {
    eventName?: string;
    path?: string;
    userId?: string;
    anonymousId?: string;
    source?: string;
    metadata?: Record<string, unknown>;
  }) {
    const eventName = input.eventName?.trim();
    const path = input.path?.trim();
    if (!eventName || !path) throw new BadRequestException('eventName 和 path 必填');
    return this.repository.createEvent({
      eventName,
      path,
      userId: input.userId,
      anonymousId: input.anonymousId,
      source: input.source,
      metadata: this.toJson(input.metadata ?? {}),
    });
  }

  private toHomeSection(section: HomeSectionRow): PublicGrowthHomeSection {
    return {
      key: section.key,
      type: section.type,
      title: section.title,
      subtitle: section.subtitle,
      layout: section.layout,
      items: section.items
        .filter((item) => Boolean(item.mediaUrl))
        .map((item) => ({
          id: item.id,
          title: item.title,
          subtitle: item.subtitle,
          mediaType: PublicCreationMediaType.image,
          mediaUrl: item.mediaUrl as string,
          posterUrl: item.posterUrl,
          href: item.href ?? '#',
          badge: item.badge,
          tags: this.asStringArray(this.asRecord(item.config).tags),
          author: null,
        } satisfies PublicGrowthMediaItem)),
    };
  }

  private templatesToMediaItems(
    input: Awaited<ReturnType<PublicGrowthRepository['findApprovedTemplateCards']>>,
    fallbacks: PublicGrowthFallbackBundle,
  ) {
    const imageTemplates = input.imageTemplates.map((template) => ({
      id: `image-template-${template.id}`,
      title: template.title,
      subtitle: template.description,
      mediaType: PublicCreationMediaType.image,
      mediaUrl: template.coverImage ?? template.exampleImages[0] ?? fallbacks.mediaItems[0].mediaUrl,
      posterUrl: template.coverImage,
      href: `/marketplace/image-templates/${template.id}`,
      badge: template.isHot ? fallbacks.labels.hotPreset : fallbacks.labels.imagePreset,
      tags: template.tags,
      author: null,
      modelUsed: template.modelHint,
    }));
    const videoTemplates = input.videoTemplates.map((template) => ({
      id: `video-template-${template.id}`,
      title: template.title,
      subtitle: template.description,
      mediaType: PublicCreationMediaType.image,
      mediaUrl: template.coverImage ?? template.exampleMedia[0] ?? fallbacks.mediaItems[1].mediaUrl,
      posterUrl: template.coverImage,
      href: `/marketplace/video-templates/${template.id}`,
      badge: template.isHot ? fallbacks.labels.hotVideo : fallbacks.labels.videoPreset,
      tags: template.tags,
      author: null,
      modelUsed: template.modelHint,
    }));
    return [...imageTemplates, ...videoTemplates] satisfies PublicGrowthMediaItem[];
  }

  private toCollection(row: CollectionRow): PublicGrowthCollection {
    return {
      slug: row.slug,
      kind: row.kind,
      title: row.title,
      description: row.description,
      heroMedia: row.heroMedia,
      tags: row.tags,
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  }

  private asString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string');
  }

  private asGrowthPageSections(value: unknown): PublicGrowthPage['sections'] {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => this.asRecord(item))
      .map((item) => ({
        title: this.asString(item.title) ?? '',
        body: this.asString(item.body) ?? '',
        mediaUrl: this.asString(item.mediaUrl),
        href: this.asString(item.href),
      }))
      .filter((item) => item.title && item.body);
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
  }
}
