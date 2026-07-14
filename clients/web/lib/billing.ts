import { DEFAULT_LANGUAGE } from '@autix/i18n';
import type { MembershipLevel, PointsPackage } from '@autix/sdk';

function getApiOrigin(): string {
  return (process.env.API_URL || 'http://localhost:4100')
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

export const getPublicMembershipLevels = (locale: string = DEFAULT_LANGUAGE) =>
  fetchJson<MembershipLevel[]>('/api/membership/public/levels', locale);

export const getPublicPointsPackages = (locale: string = DEFAULT_LANGUAGE) =>
  fetchJson<PointsPackage[]>('/api/points/packages', locale);
