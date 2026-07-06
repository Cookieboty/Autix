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
 * Fetch a URL and return its content as a base64 data URL.
 */
export async function fetchUrlAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const res = await safeFetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch image: ${url} (${res.status})`);
  }
  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  const mimeType = res.headers.get('content-type') ?? 'image/png';
  return { base64, mimeType };
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

/**
 * Parse OpenAI-style image API response: data[].b64_json or data[].url.
 */
export function readOpenAIImageResponse(
  data: { data?: Array<{ b64_json?: string; url?: string }> } | undefined,
): string[] {
  return (data?.data ?? [])
    .map((item) =>
      item.b64_json ? `data:image/png;base64,${item.b64_json}` : item.url,
    )
    .filter((url): url is string => Boolean(url));
}

/**
 * Assert that a fetch response is OK; throw with body excerpt if not.
 */
export async function assertResponseOk(response: Response, label = 'Image API'): Promise<void> {
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`${label} ${response.status}: ${text.slice(0, 500)}`);
  }
}
