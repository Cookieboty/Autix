/**
 * Shared resolution logic for a model's `apiKey` / `baseUrl`.
 *
 * `model_configs` rows can legitimately be seeded with `apiKey`/`baseUrl` set
 * to `null` (all models currently use the `amux` OpenAI-compatible gateway).
 * Rather than break every call, unset fields fall back to a system-wide
 * gateway credential configured via environment variables, so an admin can
 * seed models without keys and let one gateway credential cover them all.
 *
 * Resolution order per field (first non-empty value wins):
 *   1. `model_configs` column value (`source.apiKey` / `source.baseUrl`)
 *   2. per-model `metadata` override (`metadata.apiKey` / `metadata.baseUrl`),
 *      when the caller already supports one
 *   3. system-wide gateway env var (`AMUX_API_KEY` / `AMUX_BASE_URL`)
 *
 * An empty string (`''`) is treated the same as `null`/`undefined` — "not
 * set" — never as a real configured value. Any hardcoded per-provider
 * default (e.g. an adapter's `https://api.openai.com` literal) is the
 * caller's responsibility and belongs *after* this resolution, not inside it.
 *
 * This is intentionally the ONLY place that reads `AMUX_API_KEY` /
 * `AMUX_BASE_URL` — every call site that builds a provider client should
 * route through `resolveApiKey` / `resolveBaseUrl` (or `resolveModelCredentials`)
 * instead of re-implementing the `??` chain.
 */

export interface ModelCredentialSource {
  apiKey?: string | null;
  baseUrl?: string | null;
  /** Raw `model_configs.metadata` JSON (or an already-narrowed record). */
  metadata?: unknown;
}

export interface ResolvedModelCredentials {
  apiKey: string | undefined;
  baseUrl: string | undefined;
}

/** Treats `null`/`undefined`/`''` (after trim) as "not set". */
function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function metadataField(metadata: unknown, key: 'apiKey' | 'baseUrl'): string | undefined {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
  return nonEmptyString((metadata as Record<string, unknown>)[key]);
}

export function resolveApiKey(source: ModelCredentialSource): string | undefined {
  return (
    nonEmptyString(source.apiKey) ??
    metadataField(source.metadata, 'apiKey') ??
    nonEmptyString(process.env.AMUX_API_KEY)
  );
}

export function resolveBaseUrl(source: ModelCredentialSource): string | undefined {
  return (
    nonEmptyString(source.baseUrl) ??
    metadataField(source.metadata, 'baseUrl') ??
    nonEmptyString(process.env.AMUX_BASE_URL)
  );
}

/** Convenience wrapper resolving both fields in one call. */
export function resolveModelCredentials(source: ModelCredentialSource): ResolvedModelCredentials {
  return { apiKey: resolveApiKey(source), baseUrl: resolveBaseUrl(source) };
}
