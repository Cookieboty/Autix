import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PublicCollectionKind,
  PublicCreationMediaType,
  PublicCreationSourceType,
  PublicCreationStatus,
  PublicPromptVisibility,
  ResourceType,
  type Prisma,
} from '../../platform/prisma/generated';
import {
  type PublicGrowthFallbackBundle,
  getPublicGrowthFallbacks,
} from './public-growth.fallbacks';
import {
  PublicGrowthRepository,
  isLivePublicCreationStatus,
  normalizeHandle,
} from './public-growth.repository';
import type {
  PublicGrowthCollection,
  PublicGrowthHome,
  PublicGrowthHomeSection,
  PublicGrowthMediaItem,
  PublicGrowthPage,
  PublishPublicCreationInput,
} from './public-growth.types';

type CreationRow = NonNullable<Awaited<ReturnType<PublicGrowthRepository['findCreation']>>>;
type HomeSectionRow = Awaited<ReturnType<PublicGrowthRepository['findHomeSections']>>[number];
type CollectionRow = NonNullable<Awaited<ReturnType<PublicGrowthRepository['findCollection']>>>;

@Injectable()
export class PublicGrowthService {
  constructor(private readonly repository: PublicGrowthRepository) {}

  async getHome(locale?: string): Promise<PublicGrowthHome> {
    const fallbacks = getPublicGrowthFallbacks(locale);
    const [sections, featuredCreations, templateCards, collections] =
      await Promise.all([
        this.repository.findHomeSections(),
        this.repository.findFeaturedPublicCreations(18),
        this.repository.findApprovedTemplateCards(8),
        this.repository.listCollections(PublicCollectionKind.COMMUNITY),
      ]);

    const mediaFromCreations = featuredCreations.map((item) => this.toMediaItem(item));
    const mediaFromTemplates = this.templatesToMediaItems(templateCards, fallbacks);
    const mediaRail = [
      ...mediaFromCreations,
      ...mediaFromTemplates,
      ...fallbacks.mediaItems,
    ].slice(0, 18);
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
    const [collection, creations] = await Promise.all([
      this.repository.findCollection(slug),
      this.repository.listCreations({
        page: 1,
        pageSize: 40,
        collectionSlug: slug,
      }),
    ]);
    const fallback = fallbacks.collections.find((item) => item.slug === slug);
    if (!collection && !fallback) throw new NotFoundException('集合不存在');

    const mappedCollection = collection ? this.toCollection(collection) : fallback!;
    const fallbackItems = fallbacks.mediaItems.filter((item) =>
      item.tags.some((tag) => mappedCollection.tags.includes(tag)),
    );
    return {
      collection: mappedCollection,
      items: creations.items.length
        ? creations.items.map((item) => this.toMediaItem(item))
        : fallbackItems.length ? fallbackItems : fallbacks.mediaItems,
    };
  }

  async listCreations(input: {
    page?: number;
    pageSize?: number;
    mediaType?: PublicCreationMediaType;
    tag?: string;
    collectionSlug?: string;
  }) {
    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.min(Math.max(1, input.pageSize ?? 24), 60);
    const result = await this.repository.listCreations({
      page,
      pageSize,
      mediaType: input.mediaType,
      tag: input.tag,
      collectionSlug: input.collectionSlug,
    });
    return {
      ...result,
      items: result.items.map((item) => this.toMediaItem(item)),
    };
  }

  async getCreation(id: string) {
    const creation = await this.repository.findCreation(id);
    if (!creation) throw new NotFoundException('公开作品不存在');
    return this.toMediaItem(creation, { includePrompt: true });
  }

  async recordView(id: string) {
    await this.ensureLiveCreation(id);
    const updated = await this.repository.incrementCreationCounter(id, 'viewCount');
    return { viewCount: updated.viewCount };
  }

  async recordShare(id: string) {
    await this.ensureLiveCreation(id);
    const updated = await this.repository.incrementCreationCounter(id, 'shareCount');
    return { shareCount: updated.shareCount };
  }

  async likeCreation(id: string, userId: string) {
    await this.ensureLiveCreation(id);
    const updated = await this.repository.likeCreation(id, userId);
    return { liked: true, likeCount: updated.likeCount };
  }

  async publishImageGeneration(
    generationId: string,
    userId: string,
    input: PublishPublicCreationInput,
  ) {
    const generation = await this.repository.findImageGenerationForPublish(generationId);
    if (!generation) throw new NotFoundException('生成记录不存在');
    if (generation.userId !== userId) throw new ForbiddenException('只能发布自己的生成结果');
    const mediaUrl = generation.generatedImages[0];
    if (!mediaUrl) throw new BadRequestException('暂无可发布的图片');

    await this.repository.ensureCreatorProfile(userId);
    const tags = this.cleanTags(input.tags?.length ? input.tags : [
      generation.template.category,
      ...generation.template.tags,
    ]);
    const title = this.resolveTitle(input.title, generation.template.title);

    return this.toMediaItem(
      await this.repository.upsertPublicCreation({
        userId,
        sourceType: PublicCreationSourceType.IMAGE_GENERATION,
        sourceId: generation.id,
        mediaType: PublicCreationMediaType.image,
        mediaUrl,
        posterUrl: generation.template.coverImage ?? mediaUrl,
        title,
        description: input.description,
        promptVisibility: input.promptVisibility ?? PublicPromptVisibility.hidden,
        promptSnapshot: generation.resolvedPrompt,
        modelUsed: generation.modelUsed,
        templateId: generation.templateId,
        status: PublicCreationStatus.PUBLISHED,
        tags,
        collectionSlug: input.collectionSlug,
      }),
      { includePrompt: true },
    );
  }

  async publishVideoProject(
    projectId: string,
    userId: string,
    input: PublishPublicCreationInput,
  ) {
    const project = await this.repository.findVideoProjectForPublish(projectId);
    if (!project) throw new NotFoundException('视频项目不存在');
    if (project.userId !== userId) throw new ForbiddenException('只能发布自己的视频项目');

    const latestGeneration = project.clips
      .flatMap((clip) => clip.generations)
      .filter((generation) => generation.videoUrl)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    if (!latestGeneration?.videoUrl) {
      throw new BadRequestException('暂无可发布的视频');
    }

    await this.repository.ensureCreatorProfile(userId);
    const title = this.resolveTitle(input.title, project.title);
    const prompt = project.clips
      .map((clip) => clip.prompt)
      .filter((value): value is string => Boolean(value?.trim()))
      .join('\n\n');

    return this.toMediaItem(
      await this.repository.upsertPublicCreation({
        userId,
        sourceType: PublicCreationSourceType.VIDEO_PROJECT,
        sourceId: project.id,
        mediaType: PublicCreationMediaType.video,
        mediaUrl: latestGeneration.videoUrl,
        posterUrl: latestGeneration.thumbnailUrl ?? latestGeneration.lastFrameUrl ?? project.coverImage,
        title,
        description: input.description,
        promptVisibility: input.promptVisibility ?? PublicPromptVisibility.hidden,
        promptSnapshot: prompt || latestGeneration.resolvedPrompt,
        modelUsed: latestGeneration.model,
        status: PublicCreationStatus.PUBLISHED,
        tags: this.cleanTags(input.tags?.length ? input.tags : ['video', 'storyboard']),
        collectionSlug: input.collectionSlug,
      }),
      { includePrompt: true },
    );
  }

  async getCreator(handle: string) {
    const profile = await this.repository.findCreatorProfile(normalizeHandle(handle));
    if (!profile) throw new NotFoundException('创作者不存在');
    const creations = await this.repository.listCreations({
      page: 1,
      pageSize: 24,
      userId: profile.userId,
    });
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
      creations: creations.items.map((item) => this.toMediaItem(item)),
    };
  }

  async getCreatorCreations(handle: string, input: { page?: number; pageSize?: number }) {
    const profile = await this.repository.findCreatorProfile(normalizeHandle(handle));
    if (!profile) throw new NotFoundException('创作者不存在');
    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.min(Math.max(1, input.pageSize ?? 24), 60);
    const result = await this.repository.listCreations({
      page,
      pageSize,
      userId: profile.userId,
    });
    return {
      ...result,
      items: result.items.map((item) => this.toMediaItem(item)),
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

  private async ensureLiveCreation(id: string) {
    const creation = await this.repository.findCreation(id);
    if (!creation) throw new NotFoundException('公开作品不存在');
    return creation;
  }

  private toHomeSection(section: HomeSectionRow): PublicGrowthHomeSection {
    return {
      key: section.key,
      type: section.type,
      title: section.title,
      subtitle: section.subtitle,
      layout: section.layout,
      items: section.items
        .map((item) => {
          if (item.creation) {
            if (!isLivePublicCreationStatus(item.creation.status)) return null;
            return this.toMediaItem(item.creation, {
              title: item.title,
              subtitle: item.subtitle,
              href: item.href,
              badge: item.badge,
            });
          }
          if (!item.mediaUrl) return null;
          return {
            id: item.id,
            title: item.title,
            subtitle: item.subtitle,
            mediaType: PublicCreationMediaType.image,
            mediaUrl: item.mediaUrl,
            posterUrl: item.posterUrl,
            href: item.href ?? '#',
            badge: item.badge,
            tags: this.asStringArray(this.asRecord(item.config).tags),
            author: null,
          } satisfies PublicGrowthMediaItem;
        })
        .filter((item): item is PublicGrowthMediaItem => Boolean(item)),
    };
  }

  private toMediaItem(
    row: CreationRow,
    options: {
      includePrompt?: boolean;
      title?: string;
      subtitle?: string | null;
      href?: string | null;
      badge?: string | null;
    } = {},
  ): PublicGrowthMediaItem {
    const profile = row.user.creatorProfile;
    const handle = profile?.handle ?? normalizeHandle(row.user.username);
    const prompt =
      options.includePrompt && row.promptVisibility === PublicPromptVisibility.public
        ? row.promptSnapshot
        : null;

    return {
      id: row.id,
      title: options.title ?? row.title,
      subtitle: options.subtitle ?? row.description,
      description: row.description,
      mediaType: row.mediaType,
      mediaUrl: row.mediaUrl,
      posterUrl: row.posterUrl,
      href: options.href ?? `/p/${row.id}`,
      badge: options.badge ?? row.modelUsed,
      tags: row.tags,
      author: {
        userId: row.user.id,
        handle,
        displayName: profile?.displayName ?? row.user.realName ?? row.user.username,
        avatar: profile?.avatar ?? row.user.avatar,
        bio: profile?.bio,
        followerCount: profile?.followerCount,
      },
      modelUsed: row.modelUsed,
      prompt,
      likeCount: row.likeCount,
      viewCount: row.viewCount,
      shareCount: row.shareCount,
      publishedAt: row.publishedAt,
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

  private resolveTitle(inputTitle: string | undefined, fallback: string) {
    const title = inputTitle?.trim() || fallback?.trim();
    if (!title) throw new BadRequestException('发布公开作品需要标题');
    return title.slice(0, 200);
  }

  private cleanTags(tags: string[] | undefined) {
    return Array.from(
      new Set(
        (tags ?? [])
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 12),
      ),
    );
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
