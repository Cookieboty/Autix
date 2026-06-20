'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AlertCircle, Calculator, ChevronRight, Loader2 } from 'lucide-react';
import {
  imageWorkbenchActions,
  listAvailableModels,
  hasChatCapability,
  hasImageCapability,
  type GenerationPricingEstimate,
  type ImageWorkbenchHistoryItem,
  type ImageTemplate,
  type MaterialAsset,
  type ModelConfigItem,
} from '@autix/shared-store';
import {
  detectImageModelKind,
  IMAGE_MODEL_CAPABILITIES,
} from '@autix/domain/image';
import {
  ImageStudioWorkspace,
  type ImageStudioModelSettings,
  type ImageStudioPromptRefinement,
  type ImageStudioReference,
} from '@autix/shared-ui/workbench';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@autix/shared-ui/ui';
import type { ImageResultItem } from '@autix/shared-ui/chat';

function buildDefaultSettings(model?: ModelConfigItem | null): ImageStudioModelSettings {
  const cap = IMAGE_MODEL_CAPABILITIES[detectImageModelKind(model)];
  return {
    size: cap.defaults.size,
    quality: cap.defaults.quality,
    count: cap.defaults.count,
    guidanceScale: 7,
    steps: 30,
    seed: '',
    promptTuning: 'auto',
    stylePreset: 'general',
    negativePrompt: '',
  };
}

function uploadableRefs(urls: string[]): ImageStudioReference[] {
  return urls.map((url, index) => ({ url, index }));
}

function resolveImagePricingTaskType(settings: ImageStudioModelSettings): string {
  const quality = normalizeImagePricingQuality(settings);
  if (quality.includes('low')) return 'gpt_image_2_low';
  if (quality.includes('high')) return 'gpt_image_2_high';
  return 'gpt_image_2_medium';
}

function normalizeImagePricingQuality(settings: ImageStudioModelSettings): 'low' | 'medium' | 'high' {
  const quality = String(settings.quality ?? '').toLowerCase();
  if (quality.includes('low')) return 'low';
  if (quality.includes('high') || quality.includes('hd')) return 'high';
  return 'medium';
}

function buildWorkbenchSettings(
  settings: ImageStudioModelSettings,
  options: { skipPromptTuning?: boolean } = {},
) {
  return {
    size: settings.size,
    quality: settings.quality,
    guidanceScale: settings.guidanceScale,
    steps: settings.steps,
    seed: settings.seed || undefined,
    promptTuning: settings.promptTuning,
    stylePreset: settings.stylePreset,
    negativePrompt: settings.negativePrompt || undefined,
    ...(options.skipPromptTuning ? { skipPromptTuning: true } : {}),
  };
}

export default function ImageWorkbenchPage() {
  const t = useTranslations('imageStudio.page');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialTemplateId = searchParams.get('templateId');
  const [models, setModels] = useState<ModelConfigItem[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [selectedChatModelId, setSelectedChatModelId] = useState<string | null>(null);
  const [settings, setSettings] = useState<ImageStudioModelSettings>(() => buildDefaultSettings());
  const [selectedSourceImages, setSelectedSourceImages] = useState<ImageStudioReference[]>([]);
  const [currentImages, setCurrentImages] = useState<ImageResultItem[]>([]);
  const [historyItems, setHistoryItems] = useState<ImageWorkbenchHistoryItem[]>([]);
  const [materialImages, setMaterialImages] = useState<MaterialAsset[]>([]);
  const [imageTemplates, setImageTemplates] = useState<ImageTemplate[]>([]);
  const [initialTemplate, setInitialTemplate] = useState<ImageTemplate | null>(null);
  const [loadingModels, setLoadingModels] = useState(true);
  const [materialsLoading, setMaterialsLoading] = useState(true);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estimateOpen, setEstimateOpen] = useState(false);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimate, setEstimate] = useState<GenerationPricingEstimate | null>(null);
  const [quickEstimate, setQuickEstimate] = useState<GenerationPricingEstimate | null>(null);
  const [quickEstimateLoading, setQuickEstimateLoading] = useState(false);
  const [pendingGenerate, setPendingGenerate] = useState<{
    prompt: string;
    sourceImages: ImageStudioReference[];
    inputImages: string[];
    editInstruction?: string;
  } | null>(null);
  const [accountBalance, setAccountBalance] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingModels(true);
    listAvailableModels()
      .then(async (data) => {
        if (cancelled) return;
        setModels(data);
        const imageModels = data.filter((m) => hasImageCapability(m.capabilities ?? []));
        const chatModels = data.filter((m) => hasChatCapability(m.capabilities ?? []));
        const preferred = imageModels.find((m) => m.isDefault) ?? imageModels[0];
        if (preferred) {
          setSelectedModelId(preferred.id);
          setSettings(buildDefaultSettings(preferred));
        }
        const preferredChat = chatModels.find((m) => m.isDefault) ?? chatModels[0];
        setSelectedChatModelId((current) => current ?? preferredChat?.id ?? null);

        try {
          const historyItems = await imageWorkbenchActions.listHistory({ pageSize: 60 });
          if (cancelled) return;
          setHistoryItems(historyItems);
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? t('historyLoadFailedWithMessage', { message: err.message }) : t('historyLoadFailed'));
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
  }, []);

  const refreshMaterialImages = async () => {
    const items = await imageWorkbenchActions.listMaterials({ type: 'image', pageSize: 80 });
    setMaterialImages(items);
  };

  useEffect(() => {
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
  }, []);

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
          setError(err instanceof Error ? t('templateLoadFailedWithMessage', { message: err.message }) : t('templateLoadFailed'));
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
    if (!selectedModelId || !selectedModel) {
      setQuickEstimate(null);
      setQuickEstimateLoading(false);
      return;
    }

    let cancelled = false;
    setQuickEstimateLoading(true);
    const pricingQuality = normalizeImagePricingQuality(settings);
    const timer = window.setTimeout(() => {
      imageWorkbenchActions
        .estimateGeneration({
          taskType: resolveImagePricingTaskType(settings),
          modelProvider: selectedModel.provider ?? undefined,
          modelName: selectedModel.model ?? selectedModelId,
          quality: pricingQuality,
          resolution: String(settings.size ?? ''),
          quantity: settings.count,
          referenceImages: selectedSourceImages.length,
        })
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
    const referenceImages = uploadableRefs(payload.inputImages ?? []);
    const taskType = resolveImagePricingTaskType(settings);
    const pricingQuality = normalizeImagePricingQuality(settings);
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
      const nextEstimate = await imageWorkbenchActions.estimateGeneration({
        taskType,
        modelProvider: selectedModel?.provider ?? undefined,
        modelName: selectedModel?.model ?? model,
        quality: pricingQuality,
        resolution: String(settings.size ?? ''),
        quantity: settings.count,
        referenceImages: (sourceImages.length ?? 0) + (referenceImages.length ?? 0),
      });
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
      const referenceImages = uploadableRefs(pendingGenerate.inputImages);
      const requestSettings = buildWorkbenchSettings(settings, { skipPromptTuning: true });
      const data = await imageWorkbenchActions.generate({
        model,
        chatModelId: selectedChatModelId ?? undefined,
        ...(pendingGenerate.editInstruction ? { editInstruction: pendingGenerate.prompt } : { prompt: pendingGenerate.prompt }),
        n: settings.count,
        sourceImages: pendingGenerate.sourceImages.length > 0 ? pendingGenerate.sourceImages : undefined,
        referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
        settings: requestSettings,
      });
      const nextImages = (data.images ?? []).map((item, index) => ({
        url: item.url,
        prompt: item.prompt ?? data.prompt,
        generationId: item.generationId,
        index: item.index ?? index,
        sourceImages: item.sourceImages,
      }));
      const generationId = nextImages[0]?.generationId ?? `local-${Date.now()}`;
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
        createdAt: new Date().toISOString(),
        images: historyImages,
        mode: pendingGenerate.editInstruction ? 'edit' : 'generate',
        settings: requestSettings,
        sourceImages: historySourceImages,
        referenceImages: historyReferenceImages,
      };
      setCurrentImages((prev) => [...prev, ...nextImages]);
      setHistoryItems((prev) => [nextHistoryItem, ...prev]);
      setSelectedSourceImages([]);
      setPendingGenerate(null);
      setEstimate(null);
      setAccountBalance((cur) => (cur == null || estimate?.estimatedCost == null ? cur : Math.max(0, cur - estimate.estimatedCost)));
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
    const referenceImages = uploadableRefs(payload.inputImages ?? []);
    return imageWorkbenchActions.refinePrompt({
      model,
      chatModelId: selectedChatModelId ?? undefined,
      prompt: payload.prompt,
      mode: payload.mode,
      sourceImages: payload.sourceImages,
      referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
      settings: buildWorkbenchSettings(settings),
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
    await imageWorkbenchActions.useMaterial(asset.id);
    setSelectedSourceImages((cur) =>
      cur.some((item) => item.url === asset.url)
        ? cur
        : [
          ...cur,
          {
            url: asset.url,
            prompt:
              typeof asset.metadata?.prompt === 'string'
                ? asset.metadata.prompt
                : asset.title,
          },
        ],
    );
  };

  const handleDeleteMaterialImage = async (asset: MaterialAsset) => {
    await imageWorkbenchActions.deleteMaterial(asset.id);
    setMaterialImages((prev) => prev.filter((item) => item.id !== asset.id));
    setSelectedSourceImages((cur) => cur.filter((item) => item.url !== asset.url));
  };

  const handleClearTemplate = () => {
    setInitialTemplate(null);
    if (!initialTemplateId) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete('templateId');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {error && (
        <div className="shrink-0 px-4 pt-4">
          <Alert variant="destructive" className="relative pr-24">
            <AlertCircle />
            <AlertTitle>{t('requestFailedTitle')}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 top-2"
              onClick={() => setError(null)}
            >
              {t('close')}
            </Button>
          </Alert>
        </div>
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
            materialImages={materialImages}
            imageTemplates={imageTemplates}
            initialTemplate={initialTemplate}
            onClearTemplate={handleClearTemplate}
            materialsLoading={materialsLoading}
            templatesLoading={templatesLoading}
            isGenerating={generating}
            estimatedGenerateCost={quickEstimate?.estimatedCost ?? null}
            estimatingGenerateCost={quickEstimateLoading}
            onGenerate={handleGenerate}
            onRefinePrompt={handleRefinePrompt}
            onMergeAnnotation={handleMergeAnnotation}
            onSelectSourceImage={(image) =>
              setSelectedSourceImages((cur) =>
                cur.some((item) => item.url === image.url)
                  ? cur
                  : [...cur, image],
              )
            }
            onSubmitFeedback={handleSubmitFeedback}
            onAddImageToMaterial={handleAddImageToMaterial}
            onDeleteHistoryTask={handleDeleteHistoryTask}
            onSelectMaterialImage={handleSelectMaterialImage}
            onDeleteMaterialImage={handleDeleteMaterialImage}
          />
        </div>
      )}

      <Dialog
        open={estimateOpen}
        onOpenChange={(open) => {
          setEstimateOpen(open);
          if (!open) {
            setPendingGenerate(null);
            setEstimate(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="size-4" />
              {t('confirmTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('confirmDescription')}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            {estimateLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {t('estimatingCost')}
              </div>
            ) : estimate ? (
              <>
                <div className="grid gap-2 rounded-lg border border-border bg-muted/20 p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{t('estimatedCost')}</span>
                    <strong>{t('pointsValue', { points: estimate.estimatedCost })}</strong>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{t('availableBalance')}</span>
                    <span>{accountBalance == null ? t('unknown') : t('pointsValue', { points: accountBalance })}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{t('taskType')}</span>
                    <span>{estimate.ruleName}</span>
                  </div>
                </div>
                <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
                  <div className="font-medium">{t('costDetails')}</div>
                  {estimate.items.map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-3 text-muted-foreground">
                      <span>{item.label}</span>
                      <span>{t('pointsValue', { points: item.amount })}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">{t('noEstimate')}</div>
            )}
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">{t('cancel')}</Button>
            </DialogClose>
            <Button onClick={confirmGenerate} disabled={estimateLoading || !estimate}>
              {t('confirmGenerate')}
              <ChevronRight className="size-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
