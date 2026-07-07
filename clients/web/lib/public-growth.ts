import { getLocale } from 'next-intl/server';
import type {
  PublicCollectionDetail,
  PublicCollectionKind,
  PublicCreatorDetail,
  PublicGrowthCollection,
  PublicGrowthPage,
  MembershipLevel,
  PointsPackage,
} from '@autix/shared-store';
import type { PublicGrowthHome } from '@autix/shared-ui/growth';
import type { ResolvedFeaturedSlot } from '@autix/domain';

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

export const getPublicHome = async (): Promise<PublicGrowthHome | null> => {
  const [home, heroSlots] = await Promise.all([
    fetchPublicGrowth<PublicGrowthHome>('/api/public/home'),
    fetchPublicGrowth<ResolvedFeaturedSlot[]>('/api/featured-slots?placement=home_hero'),
  ]);
  if (!home) return null;
  return { ...home, heroSlots: heroSlots ?? [] };
};

export const getPublicGrowthPage = (slug: string) =>
  fetchPublicGrowth<PublicGrowthPage>(`/api/public/pages/${encodeURIComponent(slug)}`);

export const getPublicCollections = (kind?: PublicCollectionKind) => {
  const query = kind ? `?kind=${encodeURIComponent(kind)}` : '';
  return fetchPublicGrowth<PublicGrowthCollection[]>(`/api/public/collections${query}`);
};

export const getPublicCollection = (slug: string) =>
  fetchPublicGrowth<PublicCollectionDetail>(`/api/public/collections/${encodeURIComponent(slug)}`);

export const getPublicCreator = (handle: string) =>
  fetchPublicGrowth<PublicCreatorDetail>(`/api/public/creators/${encodeURIComponent(handle)}`);

export const getPublicMembershipLevels = () =>
  fetchPublicGrowth<MembershipLevel[]>('/api/membership/public/levels');

export const getPublicPointsPackages = () =>
  fetchPublicGrowth<PointsPackage[]>('/api/points/packages');
