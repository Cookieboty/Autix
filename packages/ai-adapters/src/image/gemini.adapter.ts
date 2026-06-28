import { assertResponseOk, fetchUrlAsBase64 } from '../core/http';
import type { ImageCallContext, ImageProviderAdapter } from './types';

/**
 * Source: Gemini API · Image generation
 *   https://ai.google.dev/gemini-api/docs/image-generation
 *   REST field path: generationConfig.responseFormat.image.aspectRatio
 *   (note: `imageConfig` is the Java/Go SDK wrapper name and must NOT appear in
 *    REST JSON.)
 *
 * The gemini-*-image family exposes aspect ratios by model:
 *   common 10: "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4"
 *              | "9:16" | "16:9" | "21:9"
 *   Gemini 3.1 Flash Image-only: "1:4" | "4:1" | "1:8" | "8:1"
 *
 * Gemini 3 image models also support `imageSize`; Autix encodes
 * aspectRatio + imageSize as `WxH@1K`, `WxH@2K`, `WxH@4K`, or `WxH@512px`.
 *
 * Whenever this table changes the matching capability entry and the spec
 * appendix C link list MUST be updated together.
 */
export const SIZE_TO_ASPECT_RATIO: Record<string, string> = {
  '1024x1024': '1:1',
  '832x1248': '2:3',
  '1248x832': '3:2',
  '864x1184': '3:4',
  '1184x864': '4:3',
  '896x1152': '4:5',
  '1152x896': '5:4',
  '768x1344': '9:16',
  '1344x768': '16:9',
  '1536x672': '21:9',
  '256x1024': '1:4',
  '512x512': '1:1',
  '424x632': '2:3',
  '632x424': '3:2',
  '448x600': '3:4',
  '1024x256': '4:1',
  '600x448': '4:3',
  '464x576': '4:5',
  '576x464': '5:4',
  '1536x192': '8:1',
  '384x688': '9:16',
  '688x384': '16:9',
  '792x168': '21:9',
  '512x2048': '1:4',
  '2048x512': '4:1',
  '384x3072': '1:8',
  '3072x384': '8:1',
  '848x1264': '2:3',
  '1264x848': '3:2',
  '896x1200': '3:4',
  '1200x896': '4:3',
  '928x1152': '4:5',
  '1152x928': '5:4',
  '768x1376': '9:16',
  '1376x768': '16:9',
  '1584x672': '21:9',
  '1024x4096': '1:4',
  '4096x1024': '4:1',
  '768x6144': '1:8',
  '6144x768': '8:1',
  '2048x2048': '1:1',
  '1696x2528': '2:3',
  '2528x1696': '3:2',
  '1792x2400': '3:4',
  '2400x1792': '4:3',
  '1856x2304': '4:5',
  '2304x1856': '5:4',
  '1536x2752': '9:16',
  '2752x1536': '16:9',
  '3168x1344': '21:9',
  '2048x8192': '1:4',
  '8192x2048': '4:1',
  '1536x12288': '1:8',
  '12288x1536': '8:1',
  '4096x4096': '1:1',
  '3392x5056': '2:3',
  '5056x3392': '3:2',
  '3584x4800': '3:4',
  '4800x3584': '4:3',
  '3712x4608': '4:5',
  '4608x3712': '5:4',
  '3072x5504': '9:16',
  '5504x3072': '16:9',
  '6336x2688': '21:9',
};

/** Defensive fallback used when an unknown size sneaks past the service-layer
 *  coerce (e.g. an older client sends a now-removed value). */
export const DEFAULT_GEMINI_ASPECT_RATIO = '1:1';

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com';
// Image generation can be slow on some providers; default 10min, tunable via env.
const IMAGE_GENERATION_TIMEOUT_MS = Number(process.env.IMAGE_GENERATION_TIMEOUT_MS) || 600_000;
const GEMINI_IMAGE_SIZES = new Set(['512px', '1K', '2K', '4K']);

export function parseGeminiSizeToken(size: string | undefined): {
  aspectRatio?: string;
  imageSize?: string;
} {
  if (!size) return {};
  const [rawSize, rawImageSize] = size.split('@');
  const aspectRatio = SIZE_TO_ASPECT_RATIO[rawSize] ?? DEFAULT_GEMINI_ASPECT_RATIO;
  const imageSize = rawImageSize && GEMINI_IMAGE_SIZES.has(rawImageSize)
    ? rawImageSize
    : undefined;
  return { aspectRatio, imageSize };
}

export class GeminiImageAdapter implements ImageProviderAdapter {
  readonly provider = 'gemini';

  async generate(ctx: ImageCallContext): Promise<string[]> {
    const parts: unknown[] = [{ text: ctx.prompt }];
    const generationConfig = this.buildGenerationConfig(ctx);
    const body = {
      contents: [{ parts }],
      generationConfig,
    };

    const results = await Promise.all(
      Array.from({ length: ctx.count }, () => this.callGenerateContent(ctx, body)),
    );
    return results.flat();
  }

  async edit(ctx: ImageCallContext): Promise<string[]> {
    const parts: unknown[] = [{ text: ctx.prompt }];

    for (const source of ctx.sourceImages ?? []) {
      const { base64, mimeType } = await fetchUrlAsBase64(source.url);
      parts.push({ inline_data: { mime_type: mimeType, data: base64 } });
    }
    for (const ref of ctx.referenceImages ?? []) {
      const { base64, mimeType } = await fetchUrlAsBase64(ref.url);
      parts.push({ inline_data: { mime_type: mimeType, data: base64 } });
    }

    const generationConfig = this.buildGenerationConfig(ctx);
    const body = {
      contents: [{ parts }],
      generationConfig,
    };

    const results = await Promise.all(
      Array.from({ length: ctx.count }, () => this.callGenerateContent(ctx, body)),
    );
    return results.flat();
  }

  private buildGenerationConfig(ctx: ImageCallContext): Record<string, unknown> {
    const config: Record<string, unknown> = {
      responseModalities: ['IMAGE'],
    };

    const parsedSize = parseGeminiSizeToken(ctx.size);
    const metadataImageSize =
      typeof ctx.metadata?.geminiImageSize === 'string'
        ? ctx.metadata.geminiImageSize
        : undefined;
    const imageSize = parsedSize.imageSize ?? metadataImageSize;

    if (parsedSize.aspectRatio || imageSize) {
      const image: Record<string, string> = {};
      if (parsedSize.aspectRatio) image.aspectRatio = parsedSize.aspectRatio;
      if (imageSize) image.imageSize = imageSize;
      config.responseFormat = { image };
    }

    return config;
  }

  private async callGenerateContent(
    ctx: ImageCallContext,
    body: unknown,
  ): Promise<string[]> {
    const baseUrl = ctx.baseUrl || DEFAULT_BASE_URL;
    const version =
      typeof ctx.metadata?.geminiEndpointVersion === 'string'
        ? ctx.metadata.geminiEndpointVersion
        : 'v1';
    const url = `${baseUrl.replace(/\/$/, '')}/${version}/models/${ctx.model}:generateContent`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': ctx.apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(IMAGE_GENERATION_TIMEOUT_MS),
    });

    await assertResponseOk(response, 'Gemini API');
    const json = (await response.json()) as GeminiResponse;
    return this.parseResponse(json);
  }

  private parseResponse(json: GeminiResponse): string[] {
    const results: string[] = [];
    for (const candidate of json.candidates ?? []) {
      for (const part of candidate.content?.parts ?? []) {
        const inl = (part as any).inlineData ?? (part as any).inline_data;
        if (inl?.data) {
          const mime = inl.mimeType ?? inl.mime_type ?? 'image/png';
          results.push(`data:${mime};base64,${inl.data}`);
        }
      }
    }
    return results;
  }
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: unknown[];
    };
  }>;
}
