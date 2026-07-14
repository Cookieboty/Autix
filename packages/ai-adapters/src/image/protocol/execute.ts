import { fetchUrlAsBlob } from '../../core/http';
import { assembleImageRequest, type AssembledRequest } from './assemble';
import { extractArtifacts } from './response';
import { ImageUpstreamError } from './types';
import type { ErrorClassification, ImageArtifact, ImageCallRequest, ImageCallResult, ProtocolPreset } from './types';

const RETRYABLE: ReadonlySet<ErrorClassification> = new Set(['rate-limit', 'timeout', 'upstream']);

function classify(preset: ProtocolPreset, status: number): ErrorClassification {
  return preset.errorMapping[String(status)] ?? preset.errorMapping['*'] ?? 'upstream';
}

/** mime → 扩展名。不再一律 .png（spec §12）。 */
function extensionFor(mimeType: string): string {
  const subtype = mimeType.split('/')[1] ?? 'png';
  return subtype === 'jpeg' ? 'jpg' : subtype.split('+')[0];
}

async function buildFormData(assembled: AssembledRequest): Promise<FormData> {
  const form = new FormData();
  for (const [key, value] of Object.entries(assembled.multipart!.fields)) form.set(key, value);
  for (const image of assembled.multipart!.images) {
    const blob = await fetchUrlAsBlob(image.url);
    form.append(image.field, blob, `${image.filename}.${extensionFor(blob.type || 'image/png')}`);
  }
  return form;
}

async function sendOnce(
  preset: ProtocolPreset, assembled: AssembledRequest,
): Promise<{ artifacts: ImageArtifact[]; httpStatus: number; requestId?: string }> {
  const init: RequestInit = {
    method: assembled.method,
    headers: assembled.headers,
    signal: AbortSignal.timeout(preset.timeoutMs),
  };
  if (assembled.multipart) {
    init.body = await buildFormData(assembled);
    // FormData 自带 boundary —— 不能手写 Content-Type
    delete (init.headers as Record<string, string>)['Content-Type'];
  } else {
    init.body = JSON.stringify(assembled.body ?? {});
  }

  let response: Response;
  try {
    response = await fetch(assembled.url, init);
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    throw new ImageUpstreamError({
      message: `image call failed: ${error instanceof Error ? error.message : String(error)}`,
      classification: timedOut ? 'timeout' : 'upstream',
      retryable: true,
    });
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const classification = classify(preset, response.status);
    throw new ImageUpstreamError({
      message: `image upstream ${response.status} (${classification})`,
      classification,
      httpStatus: response.status,
      retryable: RETRYABLE.has(classification),
      upstreamBody: body.slice(0, 500),
    });
  }

  const json = await response.json().catch(() => undefined);
  return {
    artifacts: extractArtifacts(preset.response, json),
    httpStatus: response.status,
    requestId: response.headers.get('x-request-id') ?? undefined,
  };
}

export async function executeImageCall(req: ImageCallRequest): Promise<ImageCallResult> {
  const started = performance.now();
  const assembled = assembleImageRequest(req);
  const { preset } = req;

  const rounds = assembled.fanOut ? assembled.fanOut.count : 1;
  const responses = assembled.fanOut
    ? await Promise.all(Array.from({ length: rounds }, () => sendOnce(preset, assembled)))
    : [await sendOnce(preset, assembled)];

  const artifacts = responses
    .flatMap((r) => r.artifacts)
    .map((artifact, index) => ({ ...artifact, index }));   // fan-out 后重新编号

  return {
    artifacts,
    applied: assembled.applied,
    upstream: {
      protocolKey: preset.key,
      endpoint: assembled.url,
      httpStatus: responses[0].httpStatus,
      requestId: responses[0].requestId,
      durationMs: Math.round(performance.now() - started),
    },
    warnings: assembled.applied.coercions,
  };
}
