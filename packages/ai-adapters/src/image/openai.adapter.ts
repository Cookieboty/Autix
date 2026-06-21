import { buildEndpoint, assertResponseOk, readOpenAIImageResponse, fetchUrlAsBlob } from '../core/http';
import { UpstreamParamsInvalidError } from '../core/errors';
import {
  detectImageModelKind,
  getImageCapability,
  mapEquivalentSize,
  type ImageModelCapability,
} from '@autix/domain/image';
import type { ImageCallContext, ImageProviderAdapter } from './types';

const GPT_IMAGE_RE = /^gpt-image/i;
const IMAGE_GENERATION_TIMEOUT_MS = 180_000;

interface ClampedParams {
  size?: string;
  quality?: string;
  count: number;
}

/**
 * Defensive last-line clamp before hitting the upstream HTTP.
 *
 * Service layer (PR-4) already runs `coerceImageParams`, so values arriving
 * here SHOULD already be legal. This guard exists to:
 *  - keep the adapter safe when it is reused outside the workflow (e.g. ad-hoc
 *    scripts, tests, future call sites);
 *  - convert any "leftover invalid" value into a sane one *silently* — we do
 *    NOT emit notes/toasts here, because those belong to the service layer.
 *
 * For `gemini-nano` (`qualities.length === 0`) the upstream simply ignores
 * `quality`; we strip it. For other kinds, an out-of-whitelist quality falls
 * back to `cap.defaults.quality`.
 */
function clampAgainstCapability(
  cap: ImageModelCapability,
  ctx: ImageCallContext,
): ClampedParams {
  const count = Math.max(1, Math.min(ctx.count, cap.maxCount));

  let size = ctx.size;
  if (size != null) {
    const ok = cap.sizes.some((o) => o.value === size);
    if (!ok) size = mapEquivalentSize(size, cap);
  }

  let quality = ctx.quality;
  if (cap.qualities.length === 0) {
    quality = undefined;
  } else if (quality != null) {
    const ok = cap.qualities.some((o) => o.value === quality);
    if (!ok) quality = cap.defaults.quality;
  }

  return { size, quality, count };
}

export class OpenAIImageAdapter implements ImageProviderAdapter {
  readonly provider = 'openai-official';

  async generate(ctx: ImageCallContext): Promise<string[]> {
    const isGptImage = GPT_IMAGE_RE.test(ctx.model);
    const cap = getImageCapability(
      detectImageModelKind({ provider: this.provider, model: ctx.model }),
    );
    const { size, quality, count } = clampAgainstCapability(cap, ctx);

    const body: Record<string, unknown> = {
      model: ctx.model,
      prompt: ctx.prompt,
      n: count,
    };
    if (!isGptImage) body.response_format = 'b64_json';
    if (size && size !== 'auto') body.size = size;
    if (quality && quality !== 'auto') body.quality = quality;

    const baseUrl = ctx.baseUrl || 'https://api.openai.com';
    console.info(
      `[OpenAIImageAdapter] generate request model=${ctx.model} requestedCount=${ctx.count} sentCount=${count} size=${size ?? '-'} quality=${quality ?? '-'} baseUrl=${baseUrl}`,
    );
    const response = await fetch(buildEndpoint(baseUrl, '/v1/images/generations'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ctx.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(IMAGE_GENERATION_TIMEOUT_MS),
    });

    await assertResponseOk(response);
    const data = await response.json();
    const images = readOpenAIImageResponse(data);
    console.info(
      `[OpenAIImageAdapter] generate response model=${ctx.model} sentCount=${count} imageCount=${images.length}`,
    );
    return images;
  }

  async edit(ctx: ImageCallContext): Promise<string[]> {
    // Kind guard: the OpenAI `/v1/images/edits` endpoint only accepts
    // `gpt-image-*` for true multi-image / multi-reference editing. Anything
    // else (legacy `dall-e-*`, openai-compatible SDXL/Flux pretending to be
    // OpenAI, …) is rejected with a typed error so the service layer can
    // surface a stable Chinese message.
    const kind = detectImageModelKind({ provider: this.provider, model: ctx.model });
    if (kind !== 'gpt-image') {
      throw new UpstreamParamsInvalidError(
        `OpenAI image edit is only supported by gpt-image models; got kind=${kind} model=${ctx.model}`,
      );
    }
    const isGptImage = true;
    const cap = getImageCapability(kind);
    const { size, quality, count } = clampAgainstCapability(cap, ctx);

    const form = new FormData();
    form.set('model', ctx.model);
    form.set('prompt', ctx.prompt);
    form.set('n', String(count));
    if (!isGptImage) form.set('response_format', 'b64_json');
    if (size && size !== 'auto') form.set('size', size);
    if (quality && quality !== 'auto') form.set('quality', quality);

    // Merge sourceImages + referenceImages into a single `image[]` multipart
    // field. `gpt-image-1`'s edits endpoint accepts an array; per spec §5.5.2
    // we keep filenames distinct so server-side logs can tell them apart.
    const sources = ctx.sourceImages ?? [];
    const refs = ctx.referenceImages ?? [];
    for (let i = 0; i < sources.length; i++) {
      const blob = await fetchUrlAsBlob(sources[i].url);
      form.append('image[]', blob, `source-${i}.png`);
    }
    for (let i = 0; i < refs.length; i++) {
      const blob = await fetchUrlAsBlob(refs[i].url);
      form.append('image[]', blob, `reference-${i}.png`);
    }

    const maskUrl = ctx.metadata?.mask;
    if (typeof maskUrl === 'string') {
      const maskBlob = await fetchUrlAsBlob(maskUrl);
      form.set('mask', maskBlob, 'mask.png');
    }

    const baseUrl = ctx.baseUrl || 'https://api.openai.com';
    console.info(
      `[OpenAIImageAdapter] edit request model=${ctx.model} requestedCount=${ctx.count} sentCount=${count} size=${size ?? '-'} quality=${quality ?? '-'} sourceImages=${sources.length} referenceImages=${refs.length} baseUrl=${baseUrl}`,
    );
    const response = await fetch(buildEndpoint(baseUrl, '/v1/images/edits'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${ctx.apiKey}` },
      body: form,
      signal: AbortSignal.timeout(IMAGE_GENERATION_TIMEOUT_MS),
    });

    await assertResponseOk(response);
    const data = await response.json();
    const images = readOpenAIImageResponse(data);
    console.info(
      `[OpenAIImageAdapter] edit response model=${ctx.model} sentCount=${count} imageCount=${images.length}`,
    );
    return images;
  }
}
