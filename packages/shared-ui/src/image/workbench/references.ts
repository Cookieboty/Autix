import type { MaterialAsset } from '@autix/shared-store';
import type { ImageStudioReference } from '../ImageStudioWorkspace';

export function appendUniqueImageReference(
  references: ImageStudioReference[],
  image: ImageStudioReference,
): ImageStudioReference[] {
  return references.some((item) => item.url === image.url)
    ? references
    : [...references, image];
}

export function materialAssetToImageReference(asset: MaterialAsset): ImageStudioReference {
  return {
    url: asset.url,
    prompt:
      typeof asset.metadata?.prompt === 'string'
        ? asset.metadata.prompt
        : asset.title,
  };
}
