const PROVIDER_ALIASES: Record<string, string> = {
  'openai-official': 'openai-official',
  openai_api: 'openai-official',
  gemini: 'gemini',
  google: 'gemini',
  imagen: 'imagen',
  'openai-compatible': 'openai-compatible',
  openai: 'openai-compatible',
  gateway: 'openai-compatible',
  amux: 'openai-compatible',
};

export function normalizeProvider(raw?: string | null): string {
  if (!raw) return 'openai-compatible';
  const key = raw.trim().toLowerCase();
  return PROVIDER_ALIASES[key] ?? 'openai-compatible';
}
