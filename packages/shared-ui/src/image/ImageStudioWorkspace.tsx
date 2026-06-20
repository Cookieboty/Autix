'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ChevronDown,
  ImageIcon,
  LayoutTemplate,
  Loader2,
  Send,
  SlidersHorizontal,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import {
  hasChatCapability,
  type ImageWorkbenchHistoryItem,
  type MaterialAsset,
  type ImageTemplate,
  type ModelConfigItem,
} from '@autix/shared-store';
import {
  buildImageWorkbenchPrompt,
  coerceClientSettings,
  detectImageModelKind,
  IMAGE_MODEL_CAPABILITIES,
} from '@autix/domain/image';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { ModelPickerPopover } from '../chat/ModelPickerPopover';
import { useImagePreview } from '../chat/ImagePreview';
import { cn } from '../ui/utils';
import type { ImageResultItem } from '../chat/MessageBubble';
import {
  PROMPT_TUNING_VALUES,
  appendEditablePromptNote,
  modelProviderLabel,
  promptToolbarControlClass,
  readFilesAsDataUrls,
  mergeHistorySettings,
  resolveImageStudioRequestInputs,
  resolveTemplatePrompt,
  type AnnotationTarget,
  type ImageAnnotationResult,
  type ImageStudioModelSettings,
  type ImageStudioPromptRefinement,
  type ImageStudioReference,
  type InspirationTab,
  type ReferenceAnnotation,
  type UploadedReference,
} from './studio/constants';
import { SelectLike } from './studio/shared/SelectLike';
import { ImageAnnotationOverlay } from './studio/annotation/ImageAnnotationOverlay';
import { ImageStudioInspirationPanel } from './studio/panels/ImageStudioInspirationPanel';
import { ImageStudioReferencesPanel } from './studio/panels/ImageStudioReferencesPanel';
import { ImageStudioResultsPanel } from './studio/panels/ImageStudioResultsPanel';
import { ImageStudioSettingsPanel } from './studio/panels/ImageStudioSettingsPanel';
import { useImageTemplateFilters } from './studio/useImageTemplateFilters';

export type {
  ImageStudioReference,
  ImageStudioModelSettings,
  ImageStudioPromptRefinement,
} from './studio/constants';

interface ImageStudioWorkspaceProps {
  imageModels: ModelConfigItem[];
  availableModels: ModelConfigItem[];
  selectedModelId: string | null;
  selectedChatModelId: string | null;
  onModelChange: (id: string) => void;
  onChatModelChange: (id: string | null) => void;
  settings: ImageStudioModelSettings;
  onSettingsChange: (settings: ImageStudioModelSettings) => void;
  activeTemplateName?: string;
  onOpenTemplateEditor?: () => void;
  selectedSourceImages: ImageStudioReference[];
  onRemoveSourceImage: (index: number) => void;
  onClearSourceImages: () => void;
  currentImages: ImageResultItem[];
  historyItems: ImageWorkbenchHistoryItem[];
  materialImages?: MaterialAsset[];
  imageTemplates?: ImageTemplate[];
  initialTemplate?: ImageTemplate | null;
  onClearTemplate?: () => void;
  materialsLoading?: boolean;
  templatesLoading?: boolean;
  isGenerating: boolean;
  estimatedGenerateCost?: number | null;
  estimatingGenerateCost?: boolean;
  onGenerate: (payload: {
    promptOverride?: string;
    editInstruction?: string;
    sourceImages?: ImageStudioReference[];
    inputImages?: string[];
  }) => void;
  onRefinePrompt?: (payload: {
    prompt: string;
    mode: 'generate' | 'edit';
    sourceImages?: ImageStudioReference[];
    inputImages?: string[];
  }) => Promise<ImageStudioPromptRefinement>;
  onMergeAnnotation?: (payload: {
    imageUrl: string;
    overlayDataUrl: string;
  }) => Promise<string>;
  onSelectSourceImage?: (image: ImageResultItem) => void;
  onSubmitFeedback?: (image: ImageResultItem, rating: 1 | 5) => Promise<void> | void;
  onAddImageToMaterial?: (image: ImageResultItem) => Promise<void> | void;
  onDeleteHistoryTask?: (item: ImageWorkbenchHistoryItem) => Promise<void> | void;
  onSelectMaterialImage?: (asset: MaterialAsset) => Promise<void> | void;
  onDeleteMaterialImage?: (asset: MaterialAsset) => Promise<void> | void;
}

export function ImageStudioWorkspace({
  imageModels,
  availableModels,
  selectedModelId,
  selectedChatModelId,
  onModelChange,
  onChatModelChange,
  settings,
  onSettingsChange,
  activeTemplateName,
  onOpenTemplateEditor,
  selectedSourceImages,
  onRemoveSourceImage,
  onClearSourceImages,
  currentImages,
  historyItems,
  materialImages = [],
  imageTemplates = [],
  initialTemplate = null,
  onClearTemplate,
  materialsLoading = false,
  templatesLoading = false,
  isGenerating,
  estimatedGenerateCost = null,
  estimatingGenerateCost = false,
  onGenerate,
  onRefinePrompt,
  onMergeAnnotation,
  onSelectSourceImage,
  onSubmitFeedback,
  onAddImageToMaterial,
  onDeleteHistoryTask,
  onSelectMaterialImage,
  onDeleteMaterialImage,
}: ImageStudioWorkspaceProps) {
  const t = useTranslations('imageStudio');
  const tStyle = useTranslations('imageStudio.stylePresets');
  const tTuning = useTranslations('imageStudio.promptTuning');
  const tProvider = useTranslations('imageStudio.modelProvider');
  const uploadedRefLabel = t('panel.refSection.uploadedLabel');
  const [prompt, setPrompt] = useState('');
  const [refineMeta, setRefineMeta] = useState<{
    before: string;
    result: ImageStudioPromptRefinement;
  } | null>(null);
  const [isRefining, setIsRefining] = useState(false);
  const [refineError, setRefineError] = useState<string | null>(null);
  const [uploadedRefs, setUploadedRefs] = useState<UploadedReference[]>([]);
  const [referenceAnnotations, setReferenceAnnotations] = useState<Record<string, ReferenceAnnotation>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inspirationOpen, setInspirationOpen] = useState(false);
  const [inspirationTab, setInspirationTab] = useState<InspirationTab>('history');
  const {
    templateSearch,
    setTemplateSearch,
    templateCategory,
    setTemplateCategory,
    templateSort,
    setTemplateSort,
    templateCategories,
    filteredTemplates,
  } = useImageTemplateFilters(imageTemplates);
  const [appliedTemplateName, setAppliedTemplateName] = useState<string | null>(null);
  const [annotationTarget, setAnnotationTarget] = useState<AnnotationTarget | null>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialTemplateAppliedRef = useRef<string | null>(null);
  const { openPreview, element: previewElement } = useImagePreview();

  const selectedModel = imageModels.find((m) => m.id === selectedModelId);
  const chatModels = availableModels.filter((m) => hasChatCapability(m.capabilities ?? []));
  const selectedChatModel = chatModels.find((m) => m.id === selectedChatModelId);

  const capability = useMemo(
    () => IMAGE_MODEL_CAPABILITIES[detectImageModelKind(selectedModel)],
    [selectedModel],
  );

  useEffect(() => {
    const { settings: next, changed } = coerceClientSettings(settings, capability);
    if (changed.length > 0) {
      onSettingsChange(next);
      toast.info(t('toast.autoAdjusted', { changes: changed.join('、') }));
    }
  }, [capability.kind]);

  const provider = modelProviderLabel(selectedModel, {
    unselected: tProvider('unselected'),
  });
  const originalPromptForImage = useMemo(
    () =>
      buildImageWorkbenchPrompt(prompt, settings, capability, {
        includePromptTuning: false,
      }).prompt,
    [prompt, settings.stylePreset, settings.negativePrompt, capability],
  );
  const finalPrompt = originalPromptForImage.trim();
  const canGenerate = finalPrompt.length > 0;
  const canRefine = Boolean(onRefinePrompt && prompt.trim() && !isRefining && !isGenerating);
  const displayedTemplateName = activeTemplateName ?? appliedTemplateName;
  useEffect(() => {
    if (!selectedModelId && imageModels[0]?.id) onModelChange(imageModels[0].id);
  }, [imageModels, onModelChange, selectedModelId]);

  const resetRefinement = () => {
    setRefineMeta(null);
    setRefineError(null);
  };

  const removeReferenceAnnotation = (url: string) => {
    setReferenceAnnotations((prev) => {
      if (!prev[url]) return prev;
      const { [url]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const updateSettings = (partial: Partial<ImageStudioModelSettings>) => {
    if (
      'promptTuning' in partial ||
      'stylePreset' in partial ||
      'negativePrompt' in partial
    ) {
      resetRefinement();
    }
    onSettingsChange({ ...settings, ...partial });
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return;
    const urls = await readFilesAsDataUrls(imageFiles);
    setUploadedRefs((prev) => [
      ...prev,
      ...urls.map((url) => ({ url, label: uploadedRefLabel })),
    ].slice(-8));
    resetRefinement();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleGenerate = () => {
    if (!canGenerate || isGenerating) return;
    const { sourceImages, inputImages, isEditMode } = resolveImageStudioRequestInputs({
      selectedSourceImages,
      uploadedRefs,
      referenceAnnotations,
    });
    onGenerate({
      ...(isEditMode
        ? { editInstruction: finalPrompt }
        : { promptOverride: finalPrompt }),
      sourceImages: sourceImages.length > 0 ? sourceImages : undefined,
      inputImages: inputImages.length > 0 ? inputImages : undefined,
    });
  };

  const handleRefinePrompt = async () => {
    if (!canRefine || !onRefinePrompt) return;
    setIsRefining(true);
    setRefineError(null);
    try {
      const { sourceImages, inputImages } = resolveImageStudioRequestInputs({
        selectedSourceImages,
        uploadedRefs,
        referenceAnnotations,
      });
      const result = await onRefinePrompt({
        prompt: prompt.trim(),
        mode: sourceImages.length > 0 ? 'edit' : 'generate',
        sourceImages: sourceImages.length > 0 ? sourceImages : undefined,
        inputImages: inputImages.length > 0 ? inputImages : undefined,
      });
      setRefineMeta({ before: prompt, result });
      setPrompt(result.refinedPrompt);
    } catch (err) {
      setRefineError(err instanceof Error ? err.message : t('toast.refineFailed'));
    } finally {
      setIsRefining(false);
    }
  };

  const handleApplyTemplate = (template: ImageTemplate) => {
    const nextPrompt = resolveTemplatePrompt(template);
    if (nextPrompt) {
      setPrompt(nextPrompt);
      resetRefinement();
    }
    setAppliedTemplateName(template.title);
    onClearTemplate?.();
  };

  const clearTemplate = () => {
    setAppliedTemplateName(null);
    initialTemplateAppliedRef.current = null;
    onClearTemplate?.();
  };

  useEffect(() => {
    if (!initialTemplate || initialTemplateAppliedRef.current === initialTemplate.id) return;
    initialTemplateAppliedRef.current = initialTemplate.id;
    handleApplyTemplate(initialTemplate);
  }, [initialTemplate]);

  const latestImages = currentImages.slice(-8).reverse();
  const selectedSourceUrls = useMemo(
    () => new Set(selectedSourceImages.map((image) => image.url)),
    [selectedSourceImages],
  );

  const handleSelectHistoryImage = (image: ImageResultItem) => {
    if (selectedSourceUrls.has(image.url)) {
      toast.info(t('toast.alreadyInEditor'));
      return;
    }
    onSelectSourceImage?.(image);
    setInspirationOpen(false);
    resetRefinement();
    toast.success(t('toast.addedToEditor'));
  };

  const handleApplyHistoryTask = (item: ImageWorkbenchHistoryItem) => {
    const matchedModel =
      (item.modelConfigId
        ? imageModels.find((model) => model.id === item.modelConfigId)
        : undefined) ??
      imageModels.find((model) => model.model === item.modelUsed);
    if (matchedModel) onModelChange(matchedModel.id);
    if (item.chatModelId && chatModels.some((model) => model.id === item.chatModelId)) {
      onChatModelChange(item.chatModelId);
    }
    onSettingsChange(mergeHistorySettings(settings, item, capability.maxCount));
    setPrompt(item.resolvedPrompt ?? '');
    setUploadedRefs(
      (item.referenceImages ?? []).map((ref) => ({
        url: ref.url,
        label: uploadedRefLabel,
      })),
    );
    setReferenceAnnotations({});
    onClearSourceImages();
    for (const ref of item.sourceImages ?? []) {
      onSelectSourceImage?.({
        url: ref.url,
        prompt: ref.prompt,
        generationId: ref.generationId,
        index: ref.index,
      });
    }
    setInspirationOpen(false);
    resetRefinement();
    toast.success(t('toast.reusedTask'));
  };

  const handleSelectMaterialImage = async (asset: MaterialAsset) => {
    if (!onSelectMaterialImage) return;
    try {
      await onSelectMaterialImage(asset);
      setInspirationOpen(false);
      resetRefinement();
      toast.success(t('toast.materialAddedToEditor'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toast.materialUseFailed'));
    }
  };

  const handleDeleteMaterialImage = async (asset: MaterialAsset) => {
    if (!onDeleteMaterialImage) return;
    try {
      await onDeleteMaterialImage(asset);
      toast.success(t('toast.materialDeleted'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toast.materialDeleteFailed'));
    }
  };

  const handleAddImageToMaterial = async (image: ImageResultItem) => {
    if (!onAddImageToMaterial) return;
    try {
      await onAddImageToMaterial(image);
      toast.success(t('toast.addedToMaterial'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toast.addToMaterialFailed'));
    }
  };

  const handleDeleteHistoryTask = async (item: ImageWorkbenchHistoryItem) => {
    if (!onDeleteHistoryTask) return;
    try {
      await onDeleteHistoryTask(item);
      toast.success(t('toast.historyDeleted'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toast.historyDeleteFailed'));
    }
  };

  const handleUseAnnotation = async (result: ImageAnnotationResult) => {
    const previousNote = referenceAnnotations[result.targetUrl]?.note;
    const mergedUrl =
      result.mergedUrl ??
      (onMergeAnnotation
        ? await onMergeAnnotation({
          imageUrl: result.targetUrl,
          overlayDataUrl: result.overlayUrl,
        })
        : null);
    if (!mergedUrl) {
      throw new Error(t('annotation.mergeFailedUserAction'));
    }
    setReferenceAnnotations((prev) => ({
      ...prev,
      [result.targetUrl]: {
        overlayUrl: result.overlayUrl,
        mergedUrl,
        note: result.note,
      },
    }));
    setPrompt((prev) =>
      appendEditablePromptNote(prev, result.note, previousNote, {
        emptyPromptSuffix: t('annotation.emptyPromptSuffix'),
      }),
    );
    setAnnotationTarget(null);
    resetRefinement();
    window.setTimeout(() => {
      const textarea = promptTextareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }, 0);
    toast.success(t('toast.promptApplied'));
  };

  return (
    <div className="flex h-full min-w-0 bg-background text-foreground">
      {settingsOpen && (
        <button
          type="button"
          aria-label={t('panel.close')}
          className="fixed inset-0 z-30 bg-background/65 backdrop-blur-sm lg:hidden"
          onClick={() => setSettingsOpen(false)}
        />
      )}
      {inspirationOpen && (
        <button
          type="button"
          aria-label={t('inspiration.close')}
          className="fixed inset-0 z-30 bg-background/65 backdrop-blur-sm xl:hidden"
          onClick={() => setInspirationOpen(false)}
        />
      )}
      <ImageStudioSettingsPanel
        open={settingsOpen}
        provider={provider}
        capability={capability}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSettingsChange={updateSettings}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">{t('header.title')}</h1>
            <p className="truncate text-xs text-muted-foreground">
              {t('header.subtitle')}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 lg:hidden" onClick={() => setSettingsOpen(true)}>
              <SlidersHorizontal className="size-3.5" />
              <span className="hidden sm:inline">{t('header.paramsButton')}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 xl:hidden"
              onClick={() => setInspirationOpen(true)}
            >
              <ImageIcon className="size-3.5" />
              <span className="hidden sm:inline">{displayedTemplateName ?? t('inspiration.title')}</span>
            </Button>
            {activeTemplateName && onOpenTemplateEditor && (
              <Button variant="ghost" size="sm" onClick={onOpenTemplateEditor}>
                {t('header.variablesButton')}
              </Button>
            )}
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-h-0 overflow-y-auto p-4">
            <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-4">
              <ImageStudioResultsPanel
                images={latestImages}
                isGenerating={isGenerating}
                onPreview={(image) => openPreview(image.url, image.prompt)}
                onUseAsSource={onSelectSourceImage}
                onSubmitFeedback={onSubmitFeedback}
                onAddToMaterial={handleAddImageToMaterial}
              />

              <ImageStudioReferencesPanel
                selectedSourceImages={selectedSourceImages}
                uploadedRefs={uploadedRefs}
                referenceAnnotations={referenceAnnotations}
                onPreview={openPreview}
                onAnnotate={setAnnotationTarget}
                onRemoveSourceImage={(image, index) => {
                  onRemoveSourceImage(index);
                  removeReferenceAnnotation(image.url);
                  resetRefinement();
                }}
                onRemoveUploadedRef={(ref, index) => {
                  setUploadedRefs((prev) => prev.filter((_, i) => i !== index));
                  removeReferenceAnnotation(ref.url);
                  resetRefinement();
                }}
                onClearAll={() => {
                  onClearSourceImages();
                  setUploadedRefs([]);
                  setReferenceAnnotations({});
                  resetRefinement();
                }}
              />

              <section className="rounded-lg border border-border bg-card p-4">
                <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold">{t('prompt.title')}</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{t('prompt.subtitle')}</span>
                      {displayedTemplateName && (
                        <button
                          type="button"
                          className="inline-flex min-w-0 items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
                          onClick={clearTemplate}
                          title={t('prompt.removeTemplate')}
                        >
                          <LayoutTemplate className="size-3" />
                          <span className="max-w-[160px] truncate">{displayedTemplateName}</span>
                          <X className="size-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-[460px]">
                    {imageModels.length > 0 ? (
                      <ModelPickerPopover
                        candidates={imageModels}
                        value={selectedModelId}
                        onChange={(id) => id && onModelChange(id)}
                        trigger={
                          <button
                            type="button"
                            className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 text-left text-xs transition-colors hover:bg-accent"
                          >
                            <span className="min-w-0 flex-1 truncate">
                              {t('prompt.imageModelPrefix')} · {selectedModel?.name ?? t('prompt.imageModelPlaceholder')}
                            </span>
                            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                          </button>
                        }
                      />
                    ) : (
                      <div className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground sm:col-span-2">
                        {t('prompt.noImageModelHint')}
                      </div>
                    )}
                    {chatModels.length > 0 && (
                      <ModelPickerPopover
                        candidates={chatModels}
                        value={selectedChatModelId}
                        onChange={onChatModelChange}
                        trigger={
                          <button
                            type="button"
                            className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 text-left text-xs transition-colors hover:bg-accent"
                          >
                            <span className="min-w-0 flex-1 truncate">
                              {t('prompt.refineModelPrefix')} · {selectedChatModel?.name ?? t('prompt.refineModelDefault')}
                            </span>
                            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                          </button>
                        }
                      />
                    )}
                  </div>
                </div>
                <textarea
                  ref={promptTextareaRef}
                  className="min-h-44 w-full resize-y rounded-md border border-border bg-background px-3 py-3 text-sm leading-6 outline-none placeholder:text-muted-foreground focus:border-primary"
                  placeholder={t('prompt.placeholder')}
                  value={prompt}
                  onChange={(e) => {
                    if (displayedTemplateName) clearTemplate();
                    setPrompt(e.target.value);
                    resetRefinement();
                  }}
                />
                <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className={cn(
                        promptToolbarControlClass,
                        capability.supportsReferenceImage
                          ? 'text-muted-foreground hover:border-primary/35 hover:bg-accent hover:text-foreground'
                          : 'cursor-not-allowed text-muted-foreground/45',
                      )}
                      onClick={() => capability.supportsReferenceImage && fileInputRef.current?.click()}
                      title={capability.supportsReferenceImage ? undefined : t('prompt.refUnsupported')}
                    >
                      <Upload className="size-4" />
                      {t('prompt.uploadRef')}
                    </button>
                    <div className="w-[150px] shrink-0">
                      <SelectLike
                        value={settings.promptTuning}
                        options={PROMPT_TUNING_VALUES.map((value) => ({ label: tTuning(value), value }))}
                        onChange={(promptTuning) => updateSettings({ promptTuning })}
                        compact
                        className="h-10 rounded-lg px-3 text-sm font-medium data-[size=default]:h-10"
                      />
                    </div>
                    <button
                      type="button"
                      className={cn(
                        promptToolbarControlClass,
                        canRefine
                          ? 'border-primary/35 bg-primary/5 text-primary hover:bg-primary/10'
                          : 'cursor-not-allowed text-muted-foreground/45',
                      )}
                      onClick={() => void handleRefinePrompt()}
                      disabled={!canRefine}
                    >
                      {isRefining ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                      {t('prompt.aiRefine')}
                    </button>
                  </div>
                  <Button
                    className="h-10 rounded-lg px-5 sm:justify-self-end"
                    onClick={handleGenerate}
                    disabled={!canGenerate || isGenerating || imageModels.length === 0}
                  >
                    {isGenerating ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    <span>{selectedSourceImages.length > 0 ? t('prompt.startEdit') : t('prompt.startGenerate')}</span>
                    {estimatingGenerateCost ? (
                      <span className="text-xs opacity-80">{t('prompt.estimating')}</span>
                    ) : estimatedGenerateCost != null ? (
                      <span className="text-xs opacity-90">{t('prompt.costPoints', { points: estimatedGenerateCost })}</span>
                    ) : null}
                  </Button>
                </div>
                {refineError && (
                  <div className="mt-3 rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {refineError}
                  </div>
                )}
                {refineMeta && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
                    <span>{t('prompt.refinedWith', { tuning: tTuning(settings.promptTuning) })}</span>
                    <div className="flex items-center gap-2">
                      {refineMeta.result.composedPrompt !== refineMeta.result.originalPrompt && (
                        <details className="relative">
                          <summary className="cursor-pointer text-primary/80 hover:text-primary">
                            {t('prompt.viewContext')}
                          </summary>
                          <pre className="absolute left-0 top-6 z-20 max-h-48 w-[min(520px,80vw)] overflow-auto rounded-md border border-border bg-popover p-3 text-[11px] leading-5 text-popover-foreground shadow-lg">
                            {refineMeta.result.composedPrompt}
                          </pre>
                        </details>
                      )}
                      <button
                        type="button"
                        className="rounded px-2 py-1 text-primary/80 hover:bg-primary/10 hover:text-primary"
                        onClick={() => {
                          setPrompt(refineMeta.before);
                          resetRefinement();
                        }}
                      >
                        {t('prompt.undoRefine')}
                      </button>
                    </div>
                  </div>
                )}
              </section>

            </div>
          </div>

          <aside
            className={cn(
              'min-h-0 border-l border-border bg-muted/14',
              inspirationOpen
                ? 'fixed inset-y-0 right-0 z-40 flex w-[min(90vw,360px)] flex-col bg-background shadow-xl'
                : 'hidden',
              'xl:static xl:z-auto xl:flex xl:flex-col xl:bg-muted/14 xl:shadow-none',
            )}
          >
            <ImageStudioInspirationPanel
              tab={inspirationTab}
              onTabChange={setInspirationTab}
              onClose={() => setInspirationOpen(false)}
              historyItems={historyItems}
              materialImages={materialImages}
              materialsLoading={materialsLoading}
              templates={filteredTemplates}
              templatesLoading={templatesLoading}
              templateSearch={templateSearch}
              onTemplateSearchChange={setTemplateSearch}
              templateCategory={templateCategory}
              onTemplateCategoryChange={setTemplateCategory}
              templateSort={templateSort}
              onTemplateSortChange={setTemplateSort}
              templateCategories={templateCategories}
              selectedSourceUrls={selectedSourceUrls}
              onPreviewImage={(image) => openPreview(image.url, image.prompt)}
              onPreviewMaterial={(asset) => openPreview(asset.url, asset.title)}
              onUseHistoryImage={handleSelectHistoryImage}
              onApplyHistoryTask={handleApplyHistoryTask}
              onAddImageToMaterial={onAddImageToMaterial ? handleAddImageToMaterial : undefined}
              onDeleteHistoryTask={onDeleteHistoryTask ? (item) => void handleDeleteHistoryTask(item) : undefined}
              onUseMaterial={(asset) => void handleSelectMaterialImage(asset)}
              onDeleteMaterial={onDeleteMaterialImage ? (asset) => void handleDeleteMaterialImage(asset) : undefined}
              onApplyTemplate={handleApplyTemplate}
            />
          </aside>
        </div>
      </main>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleUpload(e.target.files)}
      />
      <button
        type="button"
        className="fixed bottom-5 right-5 z-30 inline-flex size-11 items-center justify-center rounded-full border border-border bg-background shadow-lg transition-colors hover:bg-accent xl:hidden"
        onClick={() => fileInputRef.current?.click()}
        title={t('prompt.uploadRef')}
      >
        <Upload className="size-4" />
      </button>
      {previewElement}
      {annotationTarget && (
        <ImageAnnotationOverlay
          target={annotationTarget}
          onClose={() => setAnnotationTarget(null)}
          onUse={handleUseAnnotation}
        />
      )}
    </div>
  );
}
