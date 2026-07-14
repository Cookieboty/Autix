import { safeFetch } from './safe-fetch';

/**
 * Normalize baseUrl + endpoint, deduplicating `/v1` if both contain it.
 */
export function buildEndpoint(baseUrl: string, endpoint: string): string {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (normalizedBase.endsWith('/v1') && normalizedEndpoint.startsWith('/v1/')) {
    return `${normalizedBase}${normalizedEndpoint.slice(3)}`;
  }
  return `${normalizedBase}${normalizedEndpoint}`;
}

/**
 * Fetch a URL and return it as a Blob.
 */
export async function fetchUrlAsBlob(url: string): Promise<Blob> {
  const res = await safeFetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch image: ${url} (${res.status})`);
  }
  return res.blob();
}
