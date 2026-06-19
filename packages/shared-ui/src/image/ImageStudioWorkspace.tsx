'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ChevronDown,
  ImageIcon,
  Images,
  LayoutTemplate,
  Loader2,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
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
  STYLE_PRESET_VALUES,
  TEMPLATE_SORT_VALUES,
  appendEditablePromptNote,
  modelProviderLabel,
  promptToolbarControlClass,
  readFilesAsDataUrls,
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
import {
  ChipButton,
  PanelLabel,
  SliderRow,
  TabButton,
} from './studio/shared/PrimitiveControls';
import { SelectLike } from './studio/shared/SelectLike';
import {
  ImageTemplateCard,
  ReferenceThumb,
} from './studio/cards/ImageTemplateCard';
import {
  GeneratedImageCard,
  ImageHistoryTaskCard,
  MaterialImageCard,
} from './studio/cards/ImageResultCards';
import { ImageAnnotationOverlay } from './studio/annotation/ImageAnnotationOverlay';

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

function numberSetting(value: unknown, fallback: number) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function stringSetting(value: unknown, fallback: string) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
}

function mergeHistorySettings(
  current: ImageStudioModelSettings,
  item: ImageWorkbenchHistoryItem,
  maxCount: number,
): ImageStudioModelSettings {
  const raw = item.settings ?? {};
  const requestedCount = numberSetting(
    raw.count,
    item.images.length || item.generatedImages.length || current.count,
  );
  return {
    size: stringSetting(raw.size, current.size),
    quality: stringSetting(raw.quality, current.quality),
    count: Math.max(1, Math.min(maxCount, Math.round(requestedCount))),
    guidanceScale: numberSetting(raw.guidanceScale, current.guidanceScale),
    steps: numberSetting(raw.steps, current.steps),
    seed: stringSetting(raw.seed, ''),
    promptTuning: stringSetting(raw.promptTuning, current.promptTuning),
    stylePreset: stringSetting(raw.stylePreset, current.stylePreset),
    negativePrompt: stringSetting(raw.negativePrompt, ''),
  };
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
  const tTemplateSort = useTranslations('imageStudio.templateSort');
  const tProvider = useTranslations('imageStudio.modelProvider');
  const uploadedRefLabel = t('panel.refSection.uploadedLabel');
  const editSourceLabel = t('panel.refSection.editSourceLabel');
  const editSourceAnnotationLabel = t('panel.refSection.editSourceAnnotation');
  const uploadedAnnotationSuffix = t('panel.refSection.uploadedAnnotationSuffix');
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
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateCategory, setTemplateCategory] = useState('all');
  const [templateSort, setTemplateSort] = useState('popular');
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
  const templateCategories = Array.from(
    new Set(imageTemplates.map((template) => template.category).filter(Boolean)),
  ).sort();
  const filteredTemplates = imageTemplates
    .filter((template) => {
      const q = templateSearch.trim().toLowerCase();
      const matchSearch =
        !q ||
        template.title.toLowerCase().includes(q) ||
        template.description?.toLowerCase().includes(q) ||
        template.tags?.some((tag) => tag.toLowerCase().includes(q));
      const matchCategory = templateCategory === 'all' || template.category === templateCategory;
      return matchSearch && matchCategory;
    })
    .sort((a, b) => {
      if (templateSort === 'newest') {
        return new Date(b.publishedAt ?? b.createdAt).getTime() - new Date(a.publishedAt ?? a.createdAt).getTime();
      }
      if (templateSort === 'likes') return (b.likeCount ?? 0) - (a.likeCount ?? 0);
      return (b.useCount ?? 0) - (a.useCount ?? 0);
    });

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

  const resolveSourceImagesForRequest = () =>
    selectedSourceImages.map((image) => {
      const annotation = referenceAnnotations[image.url];
      if (!annotation) return image;
      return {
        ...image,
        url: annotation.mergedUrl,
        prompt: [image.prompt, annotation.note].filter(Boolean).join('\n'),
      };
    });

  const resolveAnnotatedUploadSourcesForRequest = () =>
    uploadedRefs.flatMap((ref, index) => {
      const annotation = referenceAnnotations[ref.url];
      return annotation
        ? [{ url: annotation.mergedUrl, prompt: annotation.note, index }]
        : [];
    });

  const resolveUploadedRefsForRequest = (excludeAnnotatedRefs: boolean) =>
    uploadedRefs
      .filter((ref) => !(excludeAnnotatedRefs && referenceAnnotations[ref.url]))
      .map((ref) => referenceAnnotations[ref.url]?.mergedUrl ?? ref.url);

  const handleGenerate = () => {
    if (!canGenerate || isGenerating) return;
    const annotatedUploadSources =
      selectedSourceImages.length === 0 ? resolveAnnotatedUploadSourcesForRequest() : [];
    const sourceImages = [
      ...resolveSourceImagesForRequest(),
      ...annotatedUploadSources,
    ];
    const inputImages = resolveUploadedRefsForRequest(annotatedUploadSources.length > 0);
    const isEditMode = sourceImages.length > 0;
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
      const annotatedUploadSources =
        selectedSourceImages.length === 0 ? resolveAnnotatedUploadSourcesForRequest() : [];
      const sourceImages = [
        ...resolveSourceImagesForRequest(),
        ...annotatedUploadSources,
      ];
      const inputImages = resolveUploadedRefsForRequest(annotatedUploadSources.length > 0);
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
      <aside
        className={cn(
          'h-full w-[300px] shrink-0 flex-col border-r border-border bg-muted/18',
          settingsOpen
            ? 'fixed inset-y-0 left-0 z-40 flex bg-background shadow-xl'
            : 'hidden',
          'lg:static lg:z-auto lg:flex lg:bg-muted/18 lg:shadow-none',
        )}
      >
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Wand2 className="size-4" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold">{t('panel.title')}</h2>
              <p className="truncate text-xs text-muted-foreground">{t('panel.subtitle', { provider })}</p>
            </div>
            <button
              type="button"
              aria-label={t('panel.close')}
              className="ml-auto inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
              onClick={() => setSettingsOpen(false)}
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="space-y-5">
            <section className="space-y-2">
              <PanelLabel icon={<Images className="size-3.5" />} label={t('panel.size.label')} />
              <div className="grid grid-cols-2 gap-2">
                {capability.sizes.map((opt) => (
                  <ChipButton
                    key={opt.value}
                    active={settings.size === opt.value}
                    onClick={() => updateSettings({ size: opt.value })}
                  >
                    {opt.label}
                  </ChipButton>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <PanelLabel icon={<SlidersHorizontal className="size-3.5" />} label={capability.qualities.length > 0 ? t('panel.quality.label') : t('panel.quality.labelCountOnly')} />
              {capability.qualities.length > 0 && (
                <div className={cn('grid gap-2', capability.qualities.length <= 3 ? 'grid-cols-3' : 'grid-cols-2')}>
                  {capability.qualities.map((opt) => (
                    <ChipButton
                      key={opt.value}
                      active={settings.quality === opt.value}
                      onClick={() => updateSettings({ quality: opt.value })}
                    >
                      {opt.label}
                    </ChipButton>
                  ))}
                </div>
              )}
              <div className={cn('grid gap-2', capability.maxCount <= 4 ? 'grid-cols-4' : 'grid-cols-5')}>
                {Array.from({ length: capability.maxCount }, (_, i) => i + 1).map((count) => (
                  <ChipButton
                    key={count}
                    active={settings.count === count}
                    onClick={() => updateSettings({ count })}
                  >
                    {t('result.imageCount', { count })}
                  </ChipButton>
                ))}
              </div>
            </section>

            {capability.showAdvancedSliders && (
              <section className="space-y-3">
                <PanelLabel icon={<SlidersHorizontal className="size-3.5" />} label={t('panel.advanced.label')} />
                <SliderRow
                  label="CFG"
                  value={settings.guidanceScale}
                  min={1}
                  max={20}
                  step={0.5}
                  onChange={(value) => updateSettings({ guidanceScale: value })}
                />
                <SliderRow
                  label="Steps"
                  value={settings.steps}
                  min={4}
                  max={60}
                  step={1}
                  onChange={(value) => updateSettings({ steps: value })}
                />
                <input
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-xs outline-none focus:border-primary"
                  placeholder={t('panel.advanced.seedPlaceholder')}
                  value={settings.seed}
                  onChange={(e) => updateSettings({ seed: e.target.value })}
                />
              </section>
            )}

            <section className="space-y-2">
              <PanelLabel icon={<Wand2 className="size-3.5" />} label={t('panel.style.label')} />
              <SelectLike
                value={settings.stylePreset}
                options={STYLE_PRESET_VALUES.map((value) => ({ label: tStyle(value), value }))}
                onChange={(stylePreset) => updateSettings({ stylePreset })}
              />
              {capability.supportsNegativePrompt !== 'none' && (
                <div className="space-y-1">
                  <textarea
                    className="min-h-20 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-xs leading-5 outline-none placeholder:text-muted-foreground focus:border-primary"
                    placeholder={t('panel.style.negativePlaceholder')}
                    value={settings.negativePrompt}
                    onChange={(e) => updateSettings({ negativePrompt: e.target.value })}
                  />
                  {capability.supportsNegativePrompt === 'prompt-injected' && settings.negativePrompt.trim() && (
                    <p className="text-[11px] text-muted-foreground">
                      {t('panel.style.negativeHint')}
                    </p>
                  )}
                </div>
              )}
            </section>
          </div>
        </div>
      </aside>

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
              <section className="flex min-h-[360px] flex-1 flex-col rounded-lg border border-border bg-card p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold">{t('result.title')}</h2>
                    <p className="text-xs text-muted-foreground">
                      {t('result.subtitle')}
                    </p>
                  </div>
                  {isGenerating && (
                    <div className="flex items-center gap-2 rounded-md bg-primary/10 px-2.5 py-1 text-xs text-primary">
                      <Loader2 className="size-3.5 animate-spin" />
                      {t('result.generating')}
                    </div>
                  )}
                </div>

                {latestImages.length === 0 ? (
                  <div className="flex min-h-[280px] flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-center">
                    <ImageIcon className="mb-3 size-10 text-muted-foreground/55" />
                    <p className="text-sm font-medium">{t('result.empty.title')}</p>
                    <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                      {t('result.empty.description')}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                    {latestImages.map((image) => (
                      <GeneratedImageCard
                        key={`${image.url}-${image.index ?? ''}`}
                        image={image}
                        onPreview={() => openPreview(image.url, image.prompt)}
                        onUseAsSource={() => onSelectSourceImage?.(image)}
                        onSubmitFeedback={onSubmitFeedback}
                        onAddToMaterial={() => handleAddImageToMaterial(image)}
                      />
                    ))}
                  </div>
                )}
              </section>

              {(selectedSourceImages.length > 0 || uploadedRefs.length > 0) && (
                <section className="rounded-lg border border-border bg-card p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-semibold">{t('reference.title')}</h2>
                      <p className="text-xs text-muted-foreground">{t('reference.subtitle')}</p>
                    </div>
                    <button
                      type="button"
                      className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-destructive"
                      onClick={() => {
                        onClearSourceImages();
                        setUploadedRefs([]);
                        setReferenceAnnotations({});
                        resetRefinement();
                      }}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                    {selectedSourceImages.map((image, index) => (
                      <ReferenceThumb
                        key={`${image.url}-${index}`}
                        url={image.url}
                        label={editSourceLabel}
                        annotationOverlayUrl={referenceAnnotations[image.url]?.overlayUrl}
                        onPreview={() => openPreview(image.url, image.prompt)}
                        onAnnotate={() =>
                          setAnnotationTarget({
                            url: image.url,
                            prompt: image.prompt,
                            label: editSourceAnnotationLabel,
                            overlayUrl: referenceAnnotations[image.url]?.overlayUrl,
                          })
                        }
                        onRemove={() => {
                          onRemoveSourceImage(index);
                          removeReferenceAnnotation(image.url);
                          resetRefinement();
                        }}
                      />
                    ))}
                    {uploadedRefs.map((ref, index) => (
                      <ReferenceThumb
                        key={`${ref.url}-${index}`}
                        url={ref.url}
                        label={ref.label}
                        annotationOverlayUrl={referenceAnnotations[ref.url]?.overlayUrl}
                        onPreview={() => openPreview(ref.url)}
                        onAnnotate={() =>
                          setAnnotationTarget({
                            url: ref.url,
                            label: `${ref.label}${uploadedAnnotationSuffix}`,
                            overlayUrl: referenceAnnotations[ref.url]?.overlayUrl,
                          })
                        }
                        onRemove={() => {
                          setUploadedRefs((prev) => prev.filter((_, i) => i !== index));
                          removeReferenceAnnotation(ref.url);
                          resetRefinement();
                        }}
                      />
                    ))}
                  </div>
                </section>
              )}

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
            <div className="border-b border-border px-4 py-3">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">{t('inspiration.title')}</h2>
                  <p className="text-xs text-muted-foreground">{t('inspiration.subtitle')}</p>
                </div>
                <button
                  type="button"
                  aria-label={t('inspiration.close')}
                  className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground xl:hidden"
                  onClick={() => setInspirationOpen(false)}
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1 rounded-md border border-border bg-background p-1">
                <TabButton
                  active={inspirationTab === 'history'}
                  onClick={() => setInspirationTab('history')}
                  icon={<Images className="size-3.5" />}
                >
                  {t('inspiration.tabs.history')}
                </TabButton>
                <TabButton
                  active={inspirationTab === 'materials'}
                  onClick={() => setInspirationTab('materials')}
                  icon={<Upload className="size-3.5" />}
                >
                  {t('inspiration.tabs.materials')}
                </TabButton>
                <TabButton
                  active={inspirationTab === 'templates'}
                  onClick={() => setInspirationTab('templates')}
                  icon={<LayoutTemplate className="size-3.5" />}
                >
                  {t('inspiration.tabs.templates')}
                </TabButton>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {inspirationTab === 'history' ? (
                historyItems.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-border px-8 text-center">
                    <Images className="mb-2 size-8 text-muted-foreground/60" />
                    <p className="text-xs text-muted-foreground">{t('inspiration.history.empty')}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {historyItems.map((item) => (
                      <ImageHistoryTaskCard
                        key={item.id}
                        item={item}
                        selectedUrls={selectedSourceUrls}
                        onPreview={(image) => openPreview(image.url, image.prompt)}
                        onUseAsSource={handleSelectHistoryImage}
                        onApplyTask={() => handleApplyHistoryTask(item)}
                        onAddToMaterial={onAddImageToMaterial ? (image) => handleAddImageToMaterial(image) : undefined}
                        onDeleteTask={onDeleteHistoryTask ? () => void handleDeleteHistoryTask(item) : undefined}
                      />
                    ))}
                  </div>
                )
              ) : inspirationTab === 'materials' ? (
                materialsLoading ? (
                  <div className="flex items-center justify-center rounded-lg border border-dashed border-border py-12 text-xs text-muted-foreground">
                    <Loader2 className="mr-2 size-3.5 animate-spin" />
                    {t('inspiration.materials.loading')}
                  </div>
                ) : materialImages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-border px-8 text-center">
                    <Upload className="mb-2 size-8 text-muted-foreground/60" />
                    <p className="text-xs text-muted-foreground">{t('inspiration.materials.empty')}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {materialImages.map((asset, index) => (
                      <MaterialImageCard
                        key={asset.id}
                        asset={asset}
                        index={index}
                        selected={selectedSourceUrls.has(asset.url)}
                        onPreview={() => openPreview(asset.url, asset.title)}
                        onUseAsSource={() => void handleSelectMaterialImage(asset)}
                        onDelete={onDeleteMaterialImage ? () => void handleDeleteMaterialImage(asset) : undefined}
                      />
                    ))}
                  </div>
                )
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <input
                        className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
                        placeholder={t('template.searchPlaceholder')}
                        value={templateSearch}
                        onChange={(e) => setTemplateSearch(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <SelectLike
                        value={templateCategory}
                        options={[
                          { label: t('template.allCategories'), value: 'all' },
                          ...templateCategories.map((category) => ({ label: category, value: category })),
                        ]}
                        onChange={setTemplateCategory}
                      />
                      <SelectLike
                        value={templateSort}
                        options={TEMPLATE_SORT_VALUES.map((value) => ({ label: tTemplateSort(value), value }))}
                        onChange={setTemplateSort}
                      />
                    </div>
                  </div>

                  {templatesLoading ? (
                    <div className="flex items-center justify-center rounded-lg border border-dashed border-border py-12 text-xs text-muted-foreground">
                      <Loader2 className="mr-2 size-3.5 animate-spin" />
                      {t('template.loading')}
                    </div>
                  ) : filteredTemplates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-8 py-12 text-center">
                      <LayoutTemplate className="mb-2 size-8 text-muted-foreground/60" />
                      <p className="text-xs text-muted-foreground">{t('template.empty')}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredTemplates.map((template) => (
                        <ImageTemplateCard
                          key={template.id}
                          template={template}
                          onApply={() => handleApplyTemplate(template)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
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
