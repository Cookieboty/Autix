import { assertResponseOk, fetchUrlAsBase64 } from '../core/http';
import type { ImageCallContext, ImageProviderAdapter } from './types';

const SIZE_TO_ASPECT_RATIO: Record<string, string> = {
  '1024x1024': '1:1',
  '1536x1024': '3:2',
  '1024x1536': '2:3',
};

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

    const aspectRatio = ctx.size ? SIZE_TO_ASPECT_RATIO[ctx.size] : undefined;
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
