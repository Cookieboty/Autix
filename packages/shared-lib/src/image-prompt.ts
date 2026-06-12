// Prompt assembly for the image workbench.
//
// Zero-dependency rule: only import from sibling './image-capabilities'.
// Shared by React UI, Nest API, and tests so prompt composition stays aligned.

import type { ImageModelCapability, ImageModelHint } from './image-capabilities';

export interface ImageWorkbenchPromptSettings {
  stylePreset?: string;
  promptTuning?: string;
  negativePrompt?: string;
  seed?: string;
}

export interface BuildImageWorkbenchPromptResult {
  prompt: string;
  additions: string[];
}

export interface BuildImageWorkbenchPromptOptions {
  includePromptTuning?: boolean;
}

export function getImageModelPromptHint(hint?: ImageModelHint | null): string {
  const provider = hint?.provider?.trim();
  const model = hint?.model?.trim();
  return [provider, model].filter(Boolean).join(' / ') || 'image model';
}

export function buildImageWorkbenchPrompt(
  base: string,
  settings: ImageWorkbenchPromptSettings | undefined | null,
  capability: ImageModelCapability,
  options: BuildImageWorkbenchPromptOptions = { includePromptTuning: true },
): BuildImageWorkbenchPromptResult {
  const chunks = [base.trim()];
  const additions: string[] = [];

  if (settings?.stylePreset && settings.stylePreset !== '通用精修') {
    const part = `风格方向: ${settings.stylePreset}`;
    chunks.push(part);
    additions.push(part);
  }
  if (
    options.includePromptTuning !== false &&
    settings?.promptTuning &&
    settings.promptTuning !== '忠实原文'
  ) {
    const part = `润色策略: ${settings.promptTuning}`;
    chunks.push(part);
    additions.push(part);
  }

  if (
    capability.supportsNegativePrompt === 'prompt-injected' &&
    settings?.negativePrompt?.trim()
  ) {
    const part = `避免: ${settings.negativePrompt.trim()}`;
    chunks.push(part);
    additions.push(part);
  }

  return { prompt: chunks.filter(Boolean).join('\n'), additions };
}
