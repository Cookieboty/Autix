'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  imageWorkbenchActions,
  type TaskEstimateResult,
  type ImageWorkbenchHistoryItem,
  type MaterialAsset,
} from '@autix/shared-store';
import type { ImageResultItem } from '../../chat/MessageBubble';
import type {
  ImageStudioPromptRefinement,
  ImageStudioReference,
} from '../ImageStudioWorkspace';
import {
  buildImageWorkbenchGenerationPresentation,
  type PendingImageWorkbenchGenerate,
} from './historyPresenter';
import { buildImageWorkbenchEstimateInput } from './pricing';
import {
  appendUniqueImageReference,
  materialAssetToImageReference,
} from './references';
import {
  buildImageWorkbenchRequestSettings,
  toUploadableImageReferences,
} from './settings';
import { resolveReferenceAnnotationKey } from '../studio/constants';
import {
  useImageWorkbenchResources,
  type ImageWorkbenchResourceOptions,
} from './useImageWorkbenchResources';

export type ImageWorkbenchControllerOptions = ImageWorkbenchResourceOptions;

export function useImageWorkbenchController(resourceOptions: ImageWorkbenchControllerOptions) {
  const t = useTranslations('imageStudio.page');
  const resources = useImageWorkbenchResources(resourceOptions);
  const [generating, setGenerating] = useState(false);
  const [estimateOpen, setEstimateOpen] = useState(false);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimate, setEstimate] = useState<TaskEstimateResult | null>(null);
  const [pendingGenerate, setPendingGenerate] =
    useState<PendingImageWorkbenchGenerate | null>(null);

  const handleGenerate = async (payload: {
    promptOverride?: string;
    editInstruction?: string;
    sourceImages?: ImageStudioReference[];
    inputImages?: string[];
  }) => {
    const model = resources.selectedModelId;
    const prompt = (payload.editInstruction ?? payload.promptOverride ?? '').trim();
    if (!model) {
      resources.setError(t('selectImageModel'));
      return;
    }
    if (!prompt) {
      resources.setError(t('promptRequired'));
      return;
    }

    const sourceImages = payload.sourceImages ?? resources.selectedSourceImages;
    const referenceImages = toUploadableImageReferences(payload.inputImages ?? []);
    setPendingGenerate({
      prompt,
      sourceImages,
      inputImages: payload.inputImages ?? [],
      ...(payload.editInstruction ? { editInstruction: prompt } : {}),
    });
    setEstimateOpen(true);
    setEstimateLoading(true);
    resources.setError(null);
    try {
      const nextEstimate = await imageWorkbenchActions.estimateGeneration(
        buildImageWorkbenchEstimateInput({
          settings: resources.settings,
          model: resources.selectedModel,
          selectedModelId: model,
          referenceImages: sourceImages.length + referenceImages.length,
        }),
      );
      setEstimate(nextEstimate);
    } catch (err) {
      setEstimate(null);
      setEstimateOpen(false);
      setPendingGenerate(null);
      resources.setError(err instanceof Error ? err.message : t('estimateFailed'));
    } finally {
      setEstimateLoading(false);
    }
  };

  const confirmGenerate = async () => {
    if (!pendingGenerate) return;
    const model = resources.selectedModelId;
    if (!model) return;
    setGenerating(true);
    resources.setError(null);
    setEstimateOpen(false);
    try {
      const referenceImages = toUploadableImageReferences(pendingGenerate.inputImages);
      const requestSettings = buildImageWorkbenchRequestSettings(resources.settings, {
        skipPromptTuning: true,
      });
      const data = await imageWorkbenchActions.generate({
        model,
        chatModelId: resources.selectedChatModelId ?? undefined,
        ...(pendingGenerate.editInstruction
          ? { editInstruction: pendingGenerate.prompt }
          : { prompt: pendingGenerate.prompt }),
        sourceImages:
          pendingGenerate.sourceImages.length > 0 ? pendingGenerate.sourceImages : undefined,
        referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
        settings: requestSettings,
      });
      const { nextImages, nextHistoryItem } = buildImageWorkbenchGenerationPresentation({
        data,
        pendingGenerate,
        requestSettings,
        model,
        selectedChatModelId: resources.selectedChatModelId,
        fallbackGenerationId: data.images?.[0]?.generationId ?? `local-${Date.now()}`,
        createdAt: new Date().toISOString(),
      });
      resources.setCurrentImages((prev) => [...prev, ...nextImages]);
      resources.setHistoryItems((prev) => [nextHistoryItem, ...prev]);
      resources.setSelectedSourceImages([]);
      setPendingGenerate(null);
      setEstimate(null);
      resources.setAccountBalance((cur) =>
        cur == null || estimate?.estimatedCost == null
          ? cur
          : Math.max(0, cur - estimate.estimatedCost),
      );
    } catch (err) {
      resources.setError(err instanceof Error ? err.message : t('generateFailed'));
    } finally {
      setGenerating(false);
    }
  };

  const handleRefinePrompt = async (payload: {
    prompt: string;
    mode: 'generate' | 'edit';
    sourceImages?: ImageStudioReference[];
    inputImages?: string[];
  }): Promise<ImageStudioPromptRefinement> => {
    const model = resources.selectedModelId;
    if (!model) throw new Error(t('selectImageModel'));
    const referenceImages = toUploadableImageReferences(payload.inputImages ?? []);
    return imageWorkbenchActions.refinePrompt({
      model,
      chatModelId: resources.selectedChatModelId ?? undefined,
      prompt: payload.prompt,
      mode: payload.mode,
      sourceImages: payload.sourceImages,
      referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
      settings: buildImageWorkbenchRequestSettings(resources.settings),
    });
  };

  const handleMergeAnnotation = async (payload: {
    imageUrl: string;
    overlayDataUrl: string;
  }) => {
    return imageWorkbenchActions.mergeAnnotation(payload);
  };

  const handleSubmitFeedback = async (image: ImageResultItem, rating: 1 | 5) => {
    const generationId = image.generationId;
    if (!generationId) throw new Error(t('missingGenerationForFeedback'));
    await imageWorkbenchActions.submitFeedback({
      generationId,
      rating,
      metadata: {
        imageUrl: image.url,
        index: image.index ?? null,
      },
    });
  };

  const handleAddImageToMaterial = async (image: ImageResultItem) => {
    if (!resources.enableMaterials) return;
    await imageWorkbenchActions.createMaterial({
      type: 'image',
      title: (image.prompt ?? t('defaultGeneratedMaterialTitle')).slice(0, 80),
      url: image.url,
      thumbnailUrl: image.url,
      sourceType: 'image_generation',
      sourceId: image.generationId ?? undefined,
      metadata: {
        prompt: image.prompt ?? null,
        index: image.index ?? null,
      },
    });
    await resources.refreshMaterialImages();
  };

  const handleDeleteHistoryTask = async (item: ImageWorkbenchHistoryItem) => {
    await imageWorkbenchActions.deleteHistory(item.id);
    resources.setHistoryItems((prev) =>
      prev.filter((historyItem) => historyItem.id !== item.id),
    );
    resources.setCurrentImages((prev) =>
      prev.filter((image) => image.generationId !== item.id),
    );
  };

  const handleSelectMaterialImage = async (asset: MaterialAsset) => {
    if (!resources.enableMaterials) return;
    await imageWorkbenchActions.useMaterial(asset.id);
    resources.setSelectedSourceImages((cur) =>
      appendUniqueImageReference(cur, materialAssetToImageReference(asset)),
    );
  };

  const handleDeleteMaterialImage = async (asset: MaterialAsset) => {
    if (!resources.enableMaterials) return;
    await imageWorkbenchActions.deleteMaterial(asset.id);
    resources.setMaterialImages((prev) => prev.filter((item) => item.id !== asset.id));
    const annotationKey = resolveReferenceAnnotationKey(materialAssetToImageReference(asset));
    resources.setSelectedSourceImages((cur) =>
      cur.filter((item) => resolveReferenceAnnotationKey(item) !== annotationKey),
    );
  };

  const handleEstimateOpenChange = (open: boolean) => {
    setEstimateOpen(open);
    if (!open) {
      setPendingGenerate(null);
      setEstimate(null);
    }
  };

  return {
    ...resources,
    estimate,
    estimateLoading,
    estimateOpen,
    generating,
    handleAddImageToMaterial,
    handleDeleteHistoryTask,
    handleDeleteMaterialImage,
    handleEstimateOpenChange,
    handleGenerate,
    handleMergeAnnotation,
    handleRefinePrompt,
    handleSelectMaterialImage,
    handleSubmitFeedback,
    confirmGenerate,
  };
}
