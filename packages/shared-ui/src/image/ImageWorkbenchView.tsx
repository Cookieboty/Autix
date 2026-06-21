'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  hasChatCapability,
  hasImageCapability,
  imageWorkbenchActions,
  listAvailableModels,
  type GenerationPricingEstimate,
  type ImageTemplate,
  type ImageWorkbenchHistoryItem,
  type MaterialAsset,
  type ModelConfigItem,
} from '@autix/shared-store';
import type { ImageResultItem } from '../chat/MessageBubble';
import {
  ImageStudioWorkspace,
  type ImageStudioModelSettings,
  type ImageStudioPromptRefinement,
  type ImageStudioReference,
} from './ImageStudioWorkspace';
import { ImageWorkbenchErrorAlert } from './workbench/ImageWorkbenchErrorAlert';
import { ImageWorkbenchEstimateDialog } from './workbench/ImageWorkbenchEstimateDialog';
import {
  buildImageWorkbenchGenerationPresentation,
  type PendingImageWorkbenchGenerate,
} from './workbench/historyPresenter';
import { buildImageWorkbenchEstimateInput } from './workbench/pricing';
import {
  appendUniqueImageReference,
  materialAssetToImageReference,
} from './workbench/references';
import {
  buildDefaultImageWorkbenchSettings,
  buildImageWorkbenchRequestSettings,
  toUploadableImageReferences,
} from './workbench/settings';

export interface ImageWorkbenchViewProps {
  initialTemplateId?: string | null;
  onInitialTemplateCleared?: () => void;
  enableMaterials?: boolean;
  enableQuickEstimate?: boolean;
  selectDefaultChatModel?: boolean;
  normalizePricingQuality?: boolean;
}

export function ImageWorkbenchView({
  initialTemplateId = null,
  onInitialTemplateCleared,
  enableMaterials = false,
  enableQuickEstimate = false,
  selectDefaultChatModel = false,
  normalizePricingQuality = false,
}: ImageWorkbenchViewProps) {
  const t = useTranslations('imageStudio.page');
  const [models, setModels] = useState<ModelConfigItem[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [selectedChatModelId, setSelectedChatModelId] = useState<string | null>(null);
  const [settings, setSettings] = useState<ImageStudioModelSettings>(() =>
    buildDefaultImageWorkbenchSettings(),
  );
  const [selectedSourceImages, setSelectedSourceImages] = useState<ImageStudioReference[]>([]);
  const [currentImages, setCurrentImages] = useState<ImageResultItem[]>([]);
  const [historyItems, setHistoryItems] = useState<ImageWorkbenchHistoryItem[]>([]);
  const [materialImages, setMaterialImages] = useState<MaterialAsset[]>([]);
  const [imageTemplates, setImageTemplates] = useState<ImageTemplate[]>([]);
  const [initialTemplate, setInitialTemplate] = useState<ImageTemplate | null>(null);
  const [loadingModels, setLoadingModels] = useState(true);
  const [materialsLoading, setMaterialsLoading] = useState(enableMaterials);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estimateOpen, setEstimateOpen] = useState(false);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimate, setEstimate] = useState<GenerationPricingEstimate | null>(null);
  const [quickEstimate, setQuickEstimate] = useState<GenerationPricingEstimate | null>(null);
  const [quickEstimateLoading, setQuickEstimateLoading] = useState(false);
  const [pendingGenerate, setPendingGenerate] =
    useState<PendingImageWorkbenchGenerate | null>(null);
  const [accountBalance, setAccountBalance] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingModels(true);
    listAvailableModels()
      .then(async (data) => {
        if (cancelled) return;
        setModels(data);
        const imageModels = data.filter((m) => hasImageCapability(m.capabilities ?? []));
        const preferred = imageModels.find((m) => m.isDefault) ?? imageModels[0];
        if (preferred) {
          setSelectedModelId(preferred.id);
          setSettings(buildDefaultImageWorkbenchSettings(preferred));
        }
        if (selectDefaultChatModel) {
          const chatModels = data.filter((m) => hasChatCapability(m.capabilities ?? []));
          const preferredChat = chatModels.find((m) => m.isDefault) ?? chatModels[0];
          setSelectedChatModelId((current) => current ?? preferredChat?.id ?? null);
        }

        try {
          const loadedHistoryItems = await imageWorkbenchActions.listHistory({ pageSize: 60 });
          if (cancelled) return;
          setHistoryItems(loadedHistoryItems);
        } catch (err) {
          if (!cancelled) {
            setError(
              err instanceof Error
                ? t('historyLoadFailedWithMessage', { message: err.message })
                : t('historyLoadFailed'),
            );
          }
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t('modelLoadFailed'));
      })
      .finally(() => {
        if (!cancelled) setLoadingModels(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectDefaultChatModel]);

  const refreshMaterialImages = async () => {
    const items = await imageWorkbenchActions.listMaterials({ type: 'image', pageSize: 80 });
    setMaterialImages(items);
  };

  useEffect(() => {
    if (!enableMaterials) {
      setMaterialImages([]);
      setMaterialsLoading(false);
      return;
    }
    let cancelled = false;
    setMaterialsLoading(true);
    imageWorkbenchActions
      .listMaterials({ type: 'image', pageSize: 80 })
      .then((items) => {
        if (!cancelled) setMaterialImages(items);
      })
      .catch(() => {
        if (!cancelled) setMaterialImages([]);
      })
      .finally(() => {
        if (!cancelled) setMaterialsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enableMaterials]);

  useEffect(() => {
    let cancelled = false;
    imageWorkbenchActions
      .getAccountBalance()
      .then((balance) => {
        if (cancelled) return;
        setAccountBalance(balance);
      })
      .catch(() => {
        if (!cancelled) setAccountBalance(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedModelId, settings.count, settings.quality, settings.size]);

  useEffect(() => {
    let cancelled = false;
    setTemplatesLoading(true);
    imageWorkbenchActions
      .listTemplates({ sort: 'popular', pageSize: 50 })
      .then(async (items) => {
        if (cancelled) return;
        let nextInitialTemplate =
          initialTemplateId ? items.find((item) => item.id === initialTemplateId) ?? null : null;
        if (initialTemplateId && !nextInitialTemplate) {
          try {
            nextInitialTemplate = await imageWorkbenchActions.getTemplate(initialTemplateId);
          } catch {
            nextInitialTemplate = null;
          }
        }
        if (cancelled) return;
        setImageTemplates(
          nextInitialTemplate && !items.some((item) => item.id === nextInitialTemplate?.id)
            ? [nextInitialTemplate, ...items]
            : items,
        );
        setInitialTemplate(nextInitialTemplate);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? t('templateLoadFailedWithMessage', { message: err.message })
              : t('templateLoadFailed'),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setTemplatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialTemplateId]);

  const imageModels = useMemo(
    () => models.filter((m) => hasImageCapability(m.capabilities ?? [])),
    [models],
  );
  const selectedModel = imageModels.find((m) => m.id === selectedModelId) ?? null;

  useEffect(() => {
    if (!enableQuickEstimate) {
      setQuickEstimate(null);
      setQuickEstimateLoading(false);
      return;
    }
    if (!selectedModelId || !selectedModel) {
      setQuickEstimate(null);
      setQuickEstimateLoading(false);
      return;
    }

    let cancelled = false;
    setQuickEstimateLoading(true);
    const timer = window.setTimeout(() => {
      imageWorkbenchActions
        .estimateGeneration(
          buildImageWorkbenchEstimateInput({
            settings,
            model: selectedModel,
            selectedModelId,
            normalizePricingQuality,
            referenceImages: selectedSourceImages.length,
          }),
        )
        .then((nextEstimate) => {
          if (!cancelled) setQuickEstimate(nextEstimate);
        })
        .catch(() => {
          if (!cancelled) setQuickEstimate(null);
        })
        .finally(() => {
          if (!cancelled) setQuickEstimateLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    enableQuickEstimate,
    normalizePricingQuality,
    selectedModelId,
    selectedModel,
    settings.count,
    settings.quality,
    settings.size,
    selectedSourceImages.length,
  ]);

  const handleGenerate = async (payload: {
    promptOverride?: string;
    editInstruction?: string;
    sourceImages?: ImageStudioReference[];
    inputImages?: string[];
  }) => {
    const model = selectedModelId;
    const prompt = (payload.editInstruction ?? payload.promptOverride ?? '').trim();
    if (!model) {
      setError(t('selectImageModel'));
      return;
    }
    if (!prompt) {
      setError(t('promptRequired'));
      return;
    }

    const sourceImages = payload.sourceImages ?? selectedSourceImages;
    const referenceImages = toUploadableImageReferences(payload.inputImages ?? []);
    setPendingGenerate({
      prompt,
      sourceImages,
      inputImages: payload.inputImages ?? [],
      ...(payload.editInstruction ? { editInstruction: prompt } : {}),
    });
    setEstimateOpen(true);
    setEstimateLoading(true);
    setError(null);
    try {
      const nextEstimate = await imageWorkbenchActions.estimateGeneration(
        buildImageWorkbenchEstimateInput({
          settings,
          model: selectedModel,
          selectedModelId: model,
          normalizePricingQuality,
          referenceImages: sourceImages.length + referenceImages.length,
        }),
      );
      setEstimate(nextEstimate);
    } catch (err) {
      setEstimate(null);
      setEstimateOpen(false);
      setPendingGenerate(null);
      setError(err instanceof Error ? err.message : t('estimateFailed'));
    } finally {
      setEstimateLoading(false);
    }
  };

  const confirmGenerate = async () => {
    if (!pendingGenerate) return;
    const model = selectedModelId;
    if (!model) return;
    setGenerating(true);
    setError(null);
    setEstimateOpen(false);
    try {
      const referenceImages = toUploadableImageReferences(pendingGenerate.inputImages);
      const requestSettings = buildImageWorkbenchRequestSettings(settings, {
        skipPromptTuning: true,
      });
      const data = await imageWorkbenchActions.generate({
        model,
        chatModelId: selectedChatModelId ?? undefined,
        ...(pendingGenerate.editInstruction
          ? { editInstruction: pendingGenerate.prompt }
          : { prompt: pendingGenerate.prompt }),
        n: settings.count,
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
        selectedChatModelId,
        fallbackGenerationId: data.images?.[0]?.generationId ?? `local-${Date.now()}`,
        createdAt: new Date().toISOString(),
      });
      setCurrentImages((prev) => [...prev, ...nextImages]);
      setHistoryItems((prev) => [nextHistoryItem, ...prev]);
      setSelectedSourceImages([]);
      setPendingGenerate(null);
      setEstimate(null);
      setAccountBalance((cur) =>
        cur == null || estimate?.estimatedCost == null
          ? cur
          : Math.max(0, cur - estimate.estimatedCost),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t('generateFailed'));
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
    const model = selectedModelId;
    if (!model) throw new Error(t('selectImageModel'));
    const referenceImages = toUploadableImageReferences(payload.inputImages ?? []);
    return imageWorkbenchActions.refinePrompt({
      model,
      chatModelId: selectedChatModelId ?? undefined,
      prompt: payload.prompt,
      mode: payload.mode,
      sourceImages: payload.sourceImages,
      referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
      settings: buildImageWorkbenchRequestSettings(settings),
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
    if (!enableMaterials) return;
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
    await refreshMaterialImages();
  };

  const handleDeleteHistoryTask = async (item: ImageWorkbenchHistoryItem) => {
    await imageWorkbenchActions.deleteHistory(item.id);
    setHistoryItems((prev) => prev.filter((historyItem) => historyItem.id !== item.id));
    setCurrentImages((prev) => prev.filter((image) => image.generationId !== item.id));
  };

  const handleSelectMaterialImage = async (asset: MaterialAsset) => {
    if (!enableMaterials) return;
    await imageWorkbenchActions.useMaterial(asset.id);
    setSelectedSourceImages((cur) =>
      appendUniqueImageReference(cur, materialAssetToImageReference(asset)),
    );
  };

  const handleDeleteMaterialImage = async (asset: MaterialAsset) => {
    if (!enableMaterials) return;
    await imageWorkbenchActions.deleteMaterial(asset.id);
    setMaterialImages((prev) => prev.filter((item) => item.id !== asset.id));
    setSelectedSourceImages((cur) => cur.filter((item) => item.url !== asset.url));
  };

  const handleClearTemplate = () => {
    setInitialTemplate(null);
    if (!initialTemplateId) return;
    onInitialTemplateCleared?.();
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {error && (
        <ImageWorkbenchErrorAlert message={error} onClose={() => setError(null)} />
      )}

      {loadingModels ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          {t('loadingWorkbench')}
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <ImageStudioWorkspace
            imageModels={imageModels}
            availableModels={models}
            selectedModelId={selectedModelId}
            selectedChatModelId={selectedChatModelId}
            onModelChange={setSelectedModelId}
            onChatModelChange={setSelectedChatModelId}
            settings={settings}
            onSettingsChange={setSettings}
            selectedSourceImages={selectedSourceImages}
            onRemoveSourceImage={(index) =>
              setSelectedSourceImages((cur) => cur.filter((_, i) => i !== index))
            }
            onClearSourceImages={() => setSelectedSourceImages([])}
            currentImages={currentImages}
            historyItems={historyItems}
            materialImages={enableMaterials ? materialImages : undefined}
            imageTemplates={imageTemplates}
            initialTemplate={initialTemplate}
            onClearTemplate={handleClearTemplate}
            materialsLoading={enableMaterials ? materialsLoading : undefined}
            templatesLoading={templatesLoading}
            isGenerating={generating}
            estimatedGenerateCost={quickEstimate?.estimatedCost ?? null}
            estimatingGenerateCost={quickEstimateLoading}
            onGenerate={handleGenerate}
            onRefinePrompt={handleRefinePrompt}
            onMergeAnnotation={handleMergeAnnotation}
            onSelectSourceImage={(image) =>
              setSelectedSourceImages((cur) =>
                appendUniqueImageReference(cur, image),
              )
            }
            onSubmitFeedback={handleSubmitFeedback}
            onAddImageToMaterial={enableMaterials ? handleAddImageToMaterial : undefined}
            onDeleteHistoryTask={enableMaterials ? handleDeleteHistoryTask : undefined}
            onSelectMaterialImage={enableMaterials ? handleSelectMaterialImage : undefined}
            onDeleteMaterialImage={enableMaterials ? handleDeleteMaterialImage : undefined}
          />
        </div>
      )}

      <ImageWorkbenchEstimateDialog
        open={estimateOpen}
        onOpenChange={(open) => {
          setEstimateOpen(open);
          if (!open) {
            setPendingGenerate(null);
            setEstimate(null);
          }
        }}
        estimateLoading={estimateLoading}
        estimate={estimate}
        accountBalance={accountBalance}
        onConfirm={confirmGenerate}
      />
    </div>
  );
}
