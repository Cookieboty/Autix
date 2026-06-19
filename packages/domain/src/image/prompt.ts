// Prompt assembly for the image workbench.
//
// Zero-dependency rule: only import from image domain siblings.
// Shared by React UI, Nest API, and tests so prompt composition stays aligned.

import type { ImageModelCapability, ImageModelHint } from './capabilities';

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

  if (settings?.stylePreset && settings.stylePreset !== 'general') {
    const part = `style direction: ${settings.stylePreset}`;
    chunks.push(part);
    additions.push(part);
  }
  if (
    options.includePromptTuning !== false &&
    settings?.promptTuning &&
    settings.promptTuning !== 'faithful'
  ) {
    const part = `prompt tuning: ${settings.promptTuning}`;
    chunks.push(part);
    additions.push(part);
  }

  if (
    capability.supportsNegativePrompt === 'prompt-injected' &&
    settings?.negativePrompt?.trim()
  ) {
    const part = `avoid: ${settings.negativePrompt.trim()}`;
    chunks.push(part);
    additions.push(part);
  }

  return { prompt: chunks.filter(Boolean).join('\n'), additions };
}
