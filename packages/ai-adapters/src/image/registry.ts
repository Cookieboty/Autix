import { normalizeProvider } from '../core/types';
import { AdapterRegistry } from '../core/registry';
import type { ImageProviderAdapter } from './types';
import { OpenAIImageAdapter } from './openai.adapter';
import { GeminiImageAdapter } from './gemini.adapter';
import { OpenAICompatibleImageAdapter } from './openai-compatible.adapter';

const openaiAdapter = new OpenAIImageAdapter();
const geminiAdapter = new GeminiImageAdapter();
const compatibleAdapter = new OpenAICompatibleImageAdapter();

const registry = new AdapterRegistry<ImageProviderAdapter>()
  .register('openai-official', openaiAdapter)
  .register('gemini', geminiAdapter)
  .setFallback(compatibleAdapter);

export function resolveImageAdapter(
  provider?: string | null,
  _metadata?: Record<string, unknown>,
): ImageProviderAdapter {
  const norm = normalizeProvider(provider);
  if (norm === 'imagen') {
    throw new Error('Imagen adapter not implemented (phase 2)');
  }
  return registry.resolve(norm);
}
