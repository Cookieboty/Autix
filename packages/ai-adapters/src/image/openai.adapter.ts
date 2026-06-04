import { buildEndpoint, assertResponseOk, readOpenAIImageResponse, fetchUrlAsBlob } from '../core/http';
import type { ImageCallContext, ImageProviderAdapter } from './types';

const GPT_IMAGE_RE = /^gpt-image/i;

export class OpenAIImageAdapter implements ImageProviderAdapter {
  readonly provider = 'openai-official';

  async generate(ctx: ImageCallContext): Promise<string[]> {
    const isGptImage = GPT_IMAGE_RE.test(ctx.model);

    const body: Record<string, unknown> = {
      model: ctx.model,
      prompt: ctx.prompt,
      n: ctx.count,
    };
    if (!isGptImage) body.response_format = 'b64_json';
    if (ctx.size && ctx.size !== 'auto') body.size = ctx.size;
    if (ctx.quality && ctx.quality !== 'auto') body.quality = ctx.quality;

    const baseUrl = ctx.baseUrl || 'https://api.openai.com';
    const response = await fetch(buildEndpoint(baseUrl, '/v1/images/generations'), {
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
    const isGptImage = GPT_IMAGE_RE.test(ctx.model);

    const form = new FormData();
    form.set('model', ctx.model);
    form.set('prompt', ctx.prompt);
    form.set('n', String(ctx.count));
    if (!isGptImage) form.set('response_format', 'b64_json');
    if (ctx.size && ctx.size !== 'auto') form.set('size', ctx.size);
    if (ctx.quality && ctx.quality !== 'auto') form.set('quality', ctx.quality);

    for (const source of ctx.sourceImages ?? []) {
      const blob = await fetchUrlAsBlob(source.url);
      form.append('image[]', blob, 'source.png');
    }

    const maskUrl = ctx.metadata?.mask;
    if (typeof maskUrl === 'string') {
      const maskBlob = await fetchUrlAsBlob(maskUrl);
      form.set('mask', maskBlob, 'mask.png');
    }

    const baseUrl = ctx.baseUrl || 'https://api.openai.com';
    const response = await fetch(buildEndpoint(baseUrl, '/v1/images/edits'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${ctx.apiKey}` },
      body: form,
    });

    await assertResponseOk(response);
    const data = await response.json();
    return readOpenAIImageResponse(data);
  }
}
