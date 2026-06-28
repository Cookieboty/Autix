import { buildEndpoint, assertResponseOk, readOpenAIImageResponse, fetchUrlAsBlob } from '../core/http';
import type { ImageCallContext, ImageProviderAdapter } from './types';

// Image generation can be slow on some providers; default 10min, tunable via env.
const IMAGE_GENERATION_TIMEOUT_MS = Number(process.env.IMAGE_GENERATION_TIMEOUT_MS) || 600_000;

export class OpenAICompatibleImageAdapter implements ImageProviderAdapter {
  readonly provider = 'openai-compatible';

  async generate(ctx: ImageCallContext): Promise<string[]> {
    const endpoint =
      typeof ctx.metadata?.imageGenerationEndpoint === 'string'
        ? ctx.metadata.imageGenerationEndpoint
        : '/v1/images/generations';

    const body: Record<string, unknown> = {
      model: ctx.model,
      prompt: ctx.prompt,
      n: ctx.count,
      response_format: 'b64_json',
    };
    if (ctx.size && ctx.size !== 'auto') body.size = ctx.size;
    if (ctx.quality && ctx.quality !== 'auto') body.quality = ctx.quality;

    const url = buildEndpoint(ctx.baseUrl ?? '', endpoint);
    console.info(
      `[OpenAICompatibleImageAdapter] generate request model=${ctx.model} count=${ctx.count} size=${ctx.size ?? '-'} quality=${ctx.quality ?? '-'} endpoint=${endpoint}`,
    );
    const images = await this.postJsonImageRequest(url, ctx.apiKey, body);
    console.info(
      `[OpenAICompatibleImageAdapter] generate response model=${ctx.model} requestedCount=${ctx.count} sentCount=${ctx.count} imageCount=${images.length}`,
    );
    return images;
  }

  private async postJsonImageRequest(
    url: string,
    apiKey: string,
    body: Record<string, unknown>,
  ): Promise<string[]> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(IMAGE_GENERATION_TIMEOUT_MS),
    });

    await assertResponseOk(response);
    const data = await response.json();
    return readOpenAIImageResponse(data);
  }

  async edit(ctx: ImageCallContext): Promise<string[]> {
    const endpoint =
      typeof ctx.metadata?.imageEditEndpoint === 'string'
        ? ctx.metadata.imageEditEndpoint
        : typeof ctx.metadata?.imageToImageEndpoint === 'string'
          ? ctx.metadata.imageToImageEndpoint
          : '/v1/images/edits';

    const form = new FormData();
    form.set('model', ctx.model);
    form.set('prompt', ctx.prompt);
    form.set('n', String(ctx.count));
    form.set('response_format', 'b64_json');
    if (ctx.size && ctx.size !== 'auto') form.set('size', ctx.size);
    if (ctx.quality && ctx.quality !== 'auto') form.set('quality', ctx.quality);

    const sourceImages = ctx.sourceImages ?? [];
    const referenceImages = ctx.referenceImages ?? [];
    const inputs = [
      ...sourceImages.map((source, index) => ({
        ...source,
        filename: `source-${index + 1}.png`,
      })),
      ...referenceImages.map((reference, index) => ({
        ...reference,
        filename: `reference-${index + 1}.png`,
      })),
    ];
    for (const [index, input] of inputs.entries()) {
      const blob = await fetchUrlAsBlob(input.url);
      form.append(index === 0 ? 'image' : `image_${index + 1}`, blob, input.filename);
    }

    console.info(
      `[OpenAICompatibleImageAdapter] edit request model=${ctx.model} count=${ctx.count} size=${ctx.size ?? '-'} quality=${ctx.quality ?? '-'} sourceImages=${sourceImages.length} referenceImages=${referenceImages.length} endpoint=${endpoint}`,
    );
    const response = await fetch(buildEndpoint(ctx.baseUrl ?? '', endpoint), {
      method: 'POST',
      headers: { Authorization: `Bearer ${ctx.apiKey}` },
      body: form,
      signal: AbortSignal.timeout(IMAGE_GENERATION_TIMEOUT_MS),
    });

    await assertResponseOk(response);
    const data = await response.json();
    const images = readOpenAIImageResponse(data);
    console.info(
      `[OpenAICompatibleImageAdapter] edit response model=${ctx.model} requestedCount=${ctx.count} imageCount=${images.length}`,
    );
    return images;
  }
}
