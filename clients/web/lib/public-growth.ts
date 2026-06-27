import { getLocale } from 'next-intl/server';
import type {
  PublicCollectionDetail,
  PublicCollectionKind,
  PublicCreatorDetail,
  PublicGrowthCollection,
  PublicGrowthHome,
  PublicGrowthMediaItem,
  PublicGrowthPage,
  MembershipLevel,
  PointsPackage,
} from '@autix/shared-store';

function getApiOrigin(): string {
  return (process.env.API_URL || 'http://localhost:4000')
    .replace(/\/+$/, '')
    .replace(/\/api$/, '');
}

async function fetchPublicGrowth<T>(path: string): Promise<T | null> {
  try {
    const locale = await getLocale();
    const url = new URL(`${getApiOrigin()}${path}`);
    url.searchParams.set('locale', locale);
    const res = await fetch(url.toString(), {
      next: { revalidate: 60 },
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    const payload = await res.json();
    return (payload && typeof payload === 'object' && 'data' in payload
      ? payload.data
      : payload) as T;
  } catch {
    return null;
  }
}

export const getPublicHome = () =>
  fetchPublicGrowth<PublicGrowthHome>('/api/public/home');

export const getPublicGrowthPage = (slug: string) =>
  fetchPublicGrowth<PublicGrowthPage>(`/api/public/pages/${encodeURIComponent(slug)}`);

export const getPublicCollections = (kind?: PublicCollectionKind) => {
  const query = kind ? `?kind=${encodeURIComponent(kind)}` : '';
  return fetchPublicGrowth<PublicGrowthCollection[]>(`/api/public/collections${query}`);
};

export const getPublicCollection = (slug: string) =>
  fetchPublicGrowth<PublicCollectionDetail>(`/api/public/collections/${encodeURIComponent(slug)}`);

export const getPublicCreations = (params: {
  pageSize?: number;
  mediaType?: 'image' | 'video';
  tag?: string;
  collectionSlug?: string;
} = {}) => {
  const search = new URLSearchParams();
  if (params.pageSize) search.set('pageSize', String(params.pageSize));
  if (params.mediaType) search.set('mediaType', params.mediaType);
  if (params.tag) search.set('tag', params.tag);
  if (params.collectionSlug) search.set('collectionSlug', params.collectionSlug);
  const query = search.toString();
  return fetchPublicGrowth<{ items: PublicGrowthMediaItem[] }>(
    `/api/public/creations${query ? `?${query}` : ''}`,
  );
};

export const getPublicCreation = (id: string) =>
  fetchPublicGrowth<PublicGrowthMediaItem>(`/api/public/creations/${encodeURIComponent(id)}`);

export const getPublicCreator = (handle: string) =>
  fetchPublicGrowth<PublicCreatorDetail>(`/api/public/creators/${encodeURIComponent(handle)}`);

export const getPublicMembershipLevels = () =>
  fetchPublicGrowth<MembershipLevel[]>('/api/membership/public/levels');

export const getPublicPointsPackages = () =>
  fetchPublicGrowth<PointsPackage[]>('/api/points/packages');
