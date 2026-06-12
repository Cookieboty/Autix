import { assertResponseOk, fetchUrlAsBase64 } from '../core/http';
import type { ImageCallContext, ImageProviderAdapter } from './types';

/**
 * Source: Gemini API · Image generation
 *   https://ai.google.dev/gemini-api/docs/image-generation
 *   REST field path: generationConfig.responseFormat.image.aspectRatio
 *   (note: `imageConfig` is the Java/Go SDK wrapper name and must NOT appear in
 *    REST JSON.)
 *
 * The gemini-*-image family (2.5-flash-image / 3-pro-image / 3.1-flash-image /
 * 3.5-flash-image …) officially exposes 14 aspect ratios:
 *   common 10: "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4"
 *              | "9:16" | "16:9" | "21:9"
 *   3.1 Flash Image-only: "1:4" | "4:1" | "1:8" | "8:1"  (UI does not expose)
 *
 * Pixel resolution is decided by the model; the UI carries `WxH` only to express
 * a ratio, and this table maps every `WxH` listed in
 * `@autix/shared-lib/image-capabilities` `IMAGE_MODEL_CAPABILITIES['gemini-nano'].sizes`
 * plus a few extra "alternate pixel" values that some upstream clients also send.
 *
 * Whenever this table changes the matching capability entry and the spec
 * appendix C link list MUST be updated together.
 */
export const SIZE_TO_ASPECT_RATIO: Record<string, string> = {
  '1024x1024': '1:1',
  '1536x1024': '3:2',
  '1024x1536': '2:3',
  '1024x768': '4:3',
  '768x1024': '3:4',
  '1024x1280': '4:5',
  '1280x1024': '5:4',
  '1792x1024': '16:9',
  '1024x1792': '9:16',
  '2016x864': '21:9',
  '1280x720': '16:9',
  '1024x576': '16:9',
  '576x1024': '9:16',
};

/** Defensive fallback used when an unknown size sneaks past the service-layer
 *  coerce (e.g. an older client sends a now-removed value). */
export const DEFAULT_GEMINI_ASPECT_RATIO = '1:1';

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com';

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

    let aspectRatio: string | undefined;
    if (ctx.size) {
      aspectRatio = SIZE_TO_ASPECT_RATIO[ctx.size] ?? DEFAULT_GEMINI_ASPECT_RATIO;
    }
    const imageSize =
      typeof ctx.metadata?.geminiImageSize === 'string'
        ? ctx.metadata.geminiImageSize
        : undefined;

    if (aspectRatio || imageSize) {
      const image: Record<string, string> = {};
      if (aspectRatio) image.aspectRatio = aspectRatio;
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
