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

/**
 * 抓取一个图片 URL，返回其 base64 与 mime 类型。用于把输入图片内联进 JSON body 的
 * `inlineData` part（Gemini generateContent 的图生图）。复用 {@link fetchUrlAsBlob} 的
 * SSRF 防护（safeFetch）。
 */
export async function fetchUrlAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const blob = await fetchUrlAsBlob(url);
  const base64 = Buffer.from(await blob.arrayBuffer()).toString('base64');
  return { base64, mimeType: blob.type || 'application/octet-stream' };
}
