import type { ImageStudioReference, ReferenceAnnotation, UploadedReference } from './constants';
import { resolveImageStudioRequestInputs } from './constants';

export interface ImageStudioGeneratePayload {
  promptOverride?: string;
  editInstruction?: string;
  sourceImages?: ImageStudioReference[];
  inputImages?: string[];
}

export interface ImageStudioRefinePayload {
  prompt: string;
  mode: 'generate' | 'edit';
  sourceImages?: ImageStudioReference[];
  inputImages?: string[];
}

export interface ImageStudioRequestSourceState {
  selectedSourceImages: ImageStudioReference[];
  uploadedRefs: UploadedReference[];
  referenceAnnotations: Record<string, ReferenceAnnotation>;
}

export function buildImageStudioGeneratePayload({
  finalPrompt,
  selectedSourceImages,
  uploadedRefs,
  referenceAnnotations,
}: ImageStudioRequestSourceState & {
  finalPrompt: string;
}): ImageStudioGeneratePayload {
  const { sourceImages, inputImages, isEditMode } = resolveImageStudioRequestInputs({
    selectedSourceImages,
    uploadedRefs,
    referenceAnnotations,
  });

  return {
    ...(isEditMode
      ? { editInstruction: finalPrompt }
      : { promptOverride: finalPrompt }),
    sourceImages: sourceImages.length > 0 ? sourceImages : undefined,
    inputImages: inputImages.length > 0 ? inputImages : undefined,
  };
}

export function buildImageStudioRefinePayload({
  prompt,
  selectedSourceImages,
  uploadedRefs,
  referenceAnnotations,
}: ImageStudioRequestSourceState & {
  prompt: string;
}): ImageStudioRefinePayload {
  const { sourceImages, inputImages } = resolveImageStudioRequestInputs({
    selectedSourceImages,
    uploadedRefs,
    referenceAnnotations,
  });

  return {
    prompt: prompt.trim(),
    mode: sourceImages.length > 0 ? 'edit' : 'generate',
    sourceImages: sourceImages.length > 0 ? sourceImages : undefined,
    inputImages: inputImages.length > 0 ? inputImages : undefined,
  };
}
