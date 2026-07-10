import { DEFAULT_LANGUAGE } from '@autix/i18n';
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

async function fetchPublicGrowth<T>(path: string, locale: string = DEFAULT_LANGUAGE): Promise<T | null> {
  try {
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

export const getPublicHome = async (locale: string = DEFAULT_LANGUAGE): Promise<PublicGrowthHome | null> => {
  const [home, heroSlots] = await Promise.all([
    fetchPublicGrowth<PublicGrowthHome>('/api/public/home', locale),
    fetchPublicGrowth<ResolvedFeaturedSlot[]>('/api/featured-slots?placement=home_hero', locale),
  ]);
  if (!home) return null;
  return { ...home, heroSlots: heroSlots ?? [] };
};

export const getPublicGrowthPage = (slug: string, locale: string = DEFAULT_LANGUAGE) =>
  fetchPublicGrowth<PublicGrowthPage>(`/api/public/pages/${encodeURIComponent(slug)}`, locale);

export const getPublicCollections = (kind?: PublicCollectionKind, locale: string = DEFAULT_LANGUAGE) => {
  const query = kind ? `?kind=${encodeURIComponent(kind)}` : '';
  return fetchPublicGrowth<PublicGrowthCollection[]>(`/api/public/collections${query}`, locale);
};

export const getPublicCollection = (slug: string, locale: string = DEFAULT_LANGUAGE) =>
  fetchPublicGrowth<PublicCollectionDetail>(`/api/public/collections/${encodeURIComponent(slug)}`, locale);

export const getPublicCreator = (handle: string, locale: string = DEFAULT_LANGUAGE) =>
  fetchPublicGrowth<PublicCreatorDetail>(`/api/public/creators/${encodeURIComponent(handle)}`, locale);

export const getPublicMembershipLevels = (locale: string = DEFAULT_LANGUAGE) =>
  fetchPublicGrowth<MembershipLevel[]>('/api/membership/public/levels', locale);

export const getPublicPointsPackages = (locale: string = DEFAULT_LANGUAGE) =>
  fetchPublicGrowth<PointsPackage[]>('/api/points/packages', locale);
