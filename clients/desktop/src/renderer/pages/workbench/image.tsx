'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, Calculator, ChevronRight, Loader2 } from 'lucide-react';
import {
  getAvailableModels,
  campaignApi,
  hasImageCapability,
  imageTemplateApi,
  imageWorkbenchApi,
  pointsApi,
  type GenerationPricingEstimate,
  type ImageWorkbenchHistoryItem,
  type ImageTemplate,
  type ModelConfigItem,
} from '@autix/sdk';
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
  const quality = String(settings.quality ?? 'medium').toLowerCase();
  if (quality.includes('low')) return 'gpt_image_2_low';
  if (quality.includes('high') || quality.includes('hd')) return 'gpt_image_2_high';
  return 'gpt_image_2_medium';
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

export function ImageWorkbenchPage() {
  const t = useTranslations('imageStudio.page');
  const [models, setModels] = useState<ModelConfigItem[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [selectedChatModelId, setSelectedChatModelId] = useState<string | null>(null);
  const [settings, setSettings] = useState<ImageStudioModelSettings>(() => buildDefaultSettings());
  const [selectedSourceImages, setSelectedSourceImages] = useState<ImageStudioReference[]>([]);
  const [currentImages, setCurrentImages] = useState<ImageResultItem[]>([]);
  const [historyItems, setHistoryItems] = useState<ImageWorkbenchHistoryItem[]>([]);
  const [imageTemplates, setImageTemplates] = useState<ImageTemplate[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estimateOpen, setEstimateOpen] = useState(false);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimate, setEstimate] = useState<GenerationPricingEstimate | null>(null);
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
    getAvailableModels()
      .then(async (res) => {
        if (cancelled) return;
        const data = (res.data ?? []) as ModelConfigItem[];
        setModels(data);
        const imageModels = data.filter((m) => hasImageCapability(m.capabilities ?? []));
        const preferred = imageModels.find((m) => m.isDefault) ?? imageModels[0];
        if (preferred) {
          setSelectedModelId(preferred.id);
          setSettings(buildDefaultSettings(preferred));
        }

        try {
          const historyRes = await imageWorkbenchApi.history({ pageSize: 60 });
          if (cancelled) return;
          setHistoryItems(historyRes.data.items ?? []);
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

  useEffect(() => {
    let cancelled = false;
    pointsApi
      .getSummary()
      .then((res) => {
        if (cancelled) return;
        setAccountBalance(res.data?.account?.availableBalance ?? res.data?.account?.balance ?? null);
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
    imageTemplateApi
      .list({ sort: 'popular', pageSize: 50 })
      .then((res) => {
        if (cancelled) return;
        setImageTemplates(res.data.items ?? []);
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
  }, []);

  const imageModels = useMemo(
    () => models.filter((m) => hasImageCapability(m.capabilities ?? [])),
    [models],
  );
  const selectedModel = imageModels.find((m) => m.id === selectedModelId) ?? null;

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
      const estimateRes = await pointsApi.estimate({
        taskType,
        modelProvider: selectedModel?.provider ?? undefined,
        modelName: selectedModel?.model ?? model,
        quality: String(settings.quality ?? 'medium'),
        resolution: String(settings.size ?? ''),
        quantity: settings.count,
        referenceImages: sourceImages.length + referenceImages.length,
      });
      setEstimate(estimateRes.data);
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
      const res = await imageWorkbenchApi.generate({
        model,
        chatModelId: selectedChatModelId ?? undefined,
        ...(pendingGenerate.editInstruction ? { editInstruction: pendingGenerate.prompt } : { prompt: pendingGenerate.prompt }),
        n: settings.count,
        sourceImages: pendingGenerate.sourceImages.length > 0 ? pendingGenerate.sourceImages : undefined,
        referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
        settings: requestSettings,
      });
      const nextImages = (res.data.images ?? []).map((item, index) => ({
        url: item.url,
        prompt: item.prompt ?? res.data.prompt,
        generationId: item.generationId,
        index: item.index ?? index,
        sourceImages: item.sourceImages,
      }));
      const generationId = nextImages[0]?.generationId ?? `local-${Date.now()}`;
      const historyImages = (res.data.images ?? []).map((image, index) => ({
        url: image.url,
        prompt: image.prompt ?? res.data.prompt,
        generationId: image.generationId ?? generationId,
        index: image.index ?? index,
        sourceImages: image.sourceImages ?? pendingGenerate.sourceImages,
        referenceImages: image.referenceImages ?? referenceImages,
      }));
      const historySourceImages = historyImages[0]?.sourceImages ?? pendingGenerate.sourceImages;
      const historyReferenceImages = historyImages[0]?.referenceImages ?? referenceImages;
      const nextHistoryItem: ImageWorkbenchHistoryItem = {
        id: generationId,
        resolvedPrompt: res.data.prompt,
        generatedImages: nextImages.map((image) => image.url),
        referenceImage: historySourceImages[0]?.url ?? historyReferenceImages[0]?.url ?? null,
        modelUsed: res.data.model,
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
    const res = await imageWorkbenchApi.refinePrompt({
      model,
      chatModelId: selectedChatModelId ?? undefined,
      prompt: payload.prompt,
      mode: payload.mode,
      sourceImages: payload.sourceImages,
      referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
      settings: buildWorkbenchSettings(settings),
    });
    return res.data;
  };

  const handleMergeAnnotation = async (payload: {
    imageUrl: string;
    overlayDataUrl: string;
  }) => {
    const res = await imageWorkbenchApi.mergeAnnotation(payload);
    return res.data.image;
  };

  const handleSubmitFeedback = async (image: ImageResultItem, rating: 1 | 5) => {
    const generationId = image.generationId;
    if (!generationId) throw new Error(t('missingGenerationForFeedback'));
    await campaignApi.submitFeedback({
      feedbackId: `image:${generationId}`,
      generationId,
      generationType: 'image',
      rating,
      metadata: {
        imageUrl: image.url,
        index: image.index ?? null,
      },
    });
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
        <div className="flex flex-1 items-center justify-center text-sm" style={{ color: 'var(--muted)' }}>
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
            imageTemplates={imageTemplates}
            templatesLoading={templatesLoading}
            isGenerating={generating}
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
