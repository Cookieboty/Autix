import type {
  ImageWorkbenchGenerateResult,
  ImageWorkbenchHistoryItem,
} from '@autix/shared-store';
import type { ImageResultItem } from '../../chat/MessageBubble';
import type { ImageStudioReference } from '../ImageStudioWorkspace';
import type { ImageWorkbenchRequestSettings } from './settings';

export interface PendingImageWorkbenchGenerate {
  prompt: string;
  sourceImages: ImageStudioReference[];
  inputImages: string[];
  editInstruction?: string;
}

export function buildImageWorkbenchGenerationPresentation({
  data,
  pendingGenerate,
  requestSettings,
  model,
  selectedChatModelId,
  fallbackGenerationId,
  createdAt,
}: {
  data: ImageWorkbenchGenerateResult;
  pendingGenerate: PendingImageWorkbenchGenerate;
  requestSettings: ImageWorkbenchRequestSettings;
  model: string;
  selectedChatModelId: string | null;
  fallbackGenerationId: string;
  createdAt: string;
}): {
  nextImages: ImageResultItem[];
  nextHistoryItem: ImageWorkbenchHistoryItem;
} {
  const nextImages = (data.images ?? []).map((item, index) => ({
    url: item.url,
    prompt: item.prompt ?? data.prompt,
    generationId: item.generationId,
    index: item.index ?? index,
    sourceImages: item.sourceImages,
  }));
  const generationId = nextImages[0]?.generationId ?? fallbackGenerationId;
  const referenceImages = pendingGenerate.inputImages.map((url, index) => ({ url, index }));
  const historyImages = (data.images ?? []).map((image, index) => ({
    url: image.url,
    prompt: image.prompt ?? data.prompt,
    generationId: image.generationId ?? generationId,
    index: image.index ?? index,
    sourceImages: image.sourceImages ?? pendingGenerate.sourceImages,
    referenceImages: image.referenceImages ?? referenceImages,
  }));
  const historySourceImages = historyImages[0]?.sourceImages ?? pendingGenerate.sourceImages;
  const historyReferenceImages = historyImages[0]?.referenceImages ?? referenceImages;
  const nextHistoryItem: ImageWorkbenchHistoryItem = {
    id: generationId,
    resolvedPrompt: data.prompt,
    generatedImages: nextImages.map((image) => image.url),
    referenceImage: historySourceImages[0]?.url ?? historyReferenceImages[0]?.url ?? null,
    modelUsed: data.model,
    modelConfigId: model,
    chatModelId: selectedChatModelId ?? null,
    status: 'completed',
    durationMs: null,
    createdAt,
    images: historyImages,
    mode: pendingGenerate.editInstruction ? 'edit' : 'generate',
    settings: requestSettings,
    sourceImages: historySourceImages,
    referenceImages: historyReferenceImages,
  };

  return { nextImages, nextHistoryItem };
}
