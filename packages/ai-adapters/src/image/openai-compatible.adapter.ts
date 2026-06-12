import { buildEndpoint, assertResponseOk, readOpenAIImageResponse, fetchUrlAsBlob } from '../core/http';
import type { ImageCallContext, ImageProviderAdapter } from './types';

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

    const response = await fetch(buildEndpoint(ctx.baseUrl ?? '', endpoint), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ctx.apiKey}`,
      },
      body: JSON.stringify(body),
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

    const response = await fetch(buildEndpoint(ctx.baseUrl ?? '', endpoint), {
      method: 'POST',
      headers: { Authorization: `Bearer ${ctx.apiKey}` },
      body: form,
    });

    await assertResponseOk(response);
    const data = await response.json();
    return readOpenAIImageResponse(data);
  }
}
