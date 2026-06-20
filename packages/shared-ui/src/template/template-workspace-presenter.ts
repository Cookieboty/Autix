import type { ImageGenerationClientConfig, ModelConfigItem } from '@autix/shared-store';

export const FALLBACK_TEMPLATE_WORKSPACE_MODELS = [
  'gpt-image-2',
  'gpt-image-1',
  'dall-e-3',
  'dall-e-2',
  'flux-pro',
  'flux-dev',
  'stable-diffusion-xl',
  'midjourney',
];

export function resolveTemplatePrompt(template: string, vars: Record<string, string>): string {
  let resolved = template;
  for (const [key, value] of Object.entries(vars)) {
    resolved = resolved.replaceAll(`{{${key}}}`, value);
  }
  return resolved;
}

export function getTemplateWorkspaceModelOptions(imageModels: ModelConfigItem[]): string[] {
  return imageModels.length > 0
    ? imageModels.map((model) => model.model)
    : FALLBACK_TEMPLATE_WORKSPACE_MODELS;
}

export function resolveTemplateWorkspaceImageConfig(
  imageModels: ModelConfigItem[],
  currentModel: string,
): ImageGenerationClientConfig | null {
  const matched = imageModels.find((model) => model.model === currentModel);
  const meta = matched?.metadata as Record<string, any> | undefined;
  const baseUrl = meta?.baseUrl;
  const apiKey = meta?.apiKey;

  if (baseUrl && apiKey) {
    return { baseUrl, apiKey };
  }

  return null;
}

export function extractGeneratedImageUrls(data: unknown): string[] {
  const imageUrls: string[] = [];
  const payload = data as any;

  if (payload?.data) {
    for (const item of payload.data) {
      if (item.b64_json) {
        imageUrls.push(`data:image/png;base64,${item.b64_json}`);
      } else if (item.url) {
        imageUrls.push(item.url);
      }
    }
  }

  return imageUrls;
}
