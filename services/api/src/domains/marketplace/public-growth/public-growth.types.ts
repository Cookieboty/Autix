import type {
  PublicCollectionKind,
  PublicCreationMediaType,
  PublicPromptVisibility,
} from '../../platform/prisma/generated';

export interface PublicGrowthAuthor {
  userId: string;
  handle: string;
  displayName: string;
  avatar: string | null;
  bio?: string | null;
  followerCount?: number;
}

export interface PublicGrowthMediaItem {
  id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  mediaType: PublicCreationMediaType;
  mediaUrl: string;
  posterUrl?: string | null;
  href: string;
  badge?: string | null;
  tags: string[];
  author?: PublicGrowthAuthor | null;
  modelUsed?: string | null;
  prompt?: string | null;
  likeCount?: number;
  viewCount?: number;
  shareCount?: number;
  publishedAt?: Date | string | null;
}

export interface PublicGrowthFeature {
  key: string;
  title: string;
  description: string;
  href: string;
  badge?: string;
  mediaUrl?: string;
  accent: string;
}

export interface PublicGrowthCollection {
  slug: string;
  kind: PublicCollectionKind;
  title: string;
  description?: string | null;
  heroMedia?: string | null;
  tags: string[];
}

export interface PublicGrowthPage {
  slug: string;
  title: string;
  description: string;
  heroMedia: string;
  eyebrow?: string;
  ctaHref?: string;
  ctaLabel?: string;
  tags: string[];
  sections: Array<{
    title: string;
    body: string;
    mediaUrl?: string;
    href?: string;
  }>;
}

export interface PublicGrowthHomeSection {
  key: string;
  type: string;
  title: string;
  subtitle?: string | null;
  layout?: string | null;
  items: PublicGrowthMediaItem[];
}

export interface PublicGrowthHome {
  promo: {
    label: string;
    href: string;
  };
  mediaRail: PublicGrowthMediaItem[];
  featureMatrix: PublicGrowthFeature[];
  banner: PublicGrowthFeature;
  masonryItems: PublicGrowthMediaItem[];
  tagRail: Array<{ label: string; href: string }>;
  sections: PublicGrowthHomeSection[];
  collections: PublicGrowthCollection[];
}

export interface PublishPublicCreationInput {
  title?: string;
  description?: string;
  tags?: string[];
  promptVisibility?: PublicPromptVisibility;
  collectionSlug?: string;
}
