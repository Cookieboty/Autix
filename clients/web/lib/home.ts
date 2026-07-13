import { DEFAULT_LANGUAGE } from '@autix/i18n';
import type { ResolvedFeaturedSlot } from '@autix/domain';

function getApiOrigin(): string {
  return (process.env.API_URL || 'http://localhost:4000')
    .replace(/\/+$/, '')
    .replace(/\/api$/, '');
}

async function fetchJson<T>(path: string, locale: string = DEFAULT_LANGUAGE): Promise<T | null> {
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

/** 首页 hero 运营位：`GET /api/featured-slots?placement=home_hero`（已 resolveSlot，@Public）。 */
export const getHomeHeroSlots = (locale: string = DEFAULT_LANGUAGE) =>
  fetchJson<ResolvedFeaturedSlot[]>('/api/featured-slots?placement=home_hero', locale);
