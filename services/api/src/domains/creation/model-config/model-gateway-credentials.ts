/**
 * Shared resolution logic for a model's `apiKey` / `baseUrl`.
 *
 * `model_configs` rows can legitimately be seeded with `apiKey`/`baseUrl` set
 * to `null` (all models currently use the `amux` OpenAI-compatible gateway).
 * Rather than break every call, unset fields fall back to a system-wide
 * gateway credential configured via environment variables, so an admin can
 * seed models without keys and let one gateway credential cover them all.
 *
 * Resolution order (first non-empty value wins):
 *
 *   `apiKey`:  1. `model_configs.apiKey` column  →  2. `AMUX_API_KEY` env
 *   `baseUrl`: 1. `model_configs.baseUrl` column →  2. `metadata.baseUrl`
 *                                                →  3. `AMUX_BASE_URL` env
 *
 * ⚠ **`apiKey` never comes from `metadata`.** `metadata` is projected out to
 * clients, so letting it double as a credential source is the same as handing
 * users the key. That channel is deleted, not masked. `metadata.baseUrl` stays
 * a legitimate per-model config channel — it is not a secret, and the client
 * whitelist DTO (`toClientModelConfig`) is what keeps it off the wire.
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

function metadataField(metadata: unknown, key: 'baseUrl'): string | undefined {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
  return nonEmptyString((metadata as Record<string, unknown>)[key]);
}

export function resolveApiKey(source: ModelCredentialSource): string | undefined {
  // ⚠ 安全底线：绝不从 metadata 读 apiKey。metadata 会被下发到客户端，
  // 兼作凭据来源就等于把密钥发给用户。凭据只来自 model_configs.apiKey 列
  // 或系统级网关 env。
  return nonEmptyString(source.apiKey) ?? nonEmptyString(process.env.AMUX_API_KEY);
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
