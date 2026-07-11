'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ParamsSchema, PricingSchema } from '@autix/domain/pricing';
import {
  hasChatCapability,
  pricingActions,
  type ImageTemplate,
  type ImageWorkbenchHistoryItem,
  type MaterialAsset,
  type ModelConfigItem,
  type TaskModel,
} from '@autix/shared-store';
import {
  buildImageWorkbenchPrompt,
  coerceClientSettings,
  detectImageModelKind,
  IMAGE_MODEL_CAPABILITIES,
} from '@autix/domain/image';
import { schemaParamsToImageSettings } from './schema-params-mapping';
import { toast } from 'sonner';
import { useImagePreview } from '../../chat/ImagePreview';
import { useRouter } from '../../navigation';
import type { ImageResultItem } from '../../chat/MessageBubble';
import {
  appendEditablePromptNote,
  readFilesAsDataUrls,
  mergeHistorySettings,
  resolveReferenceAnnotationKey,
  resolveTemplatePrompt,
  type AnnotationTarget,
  type ImageAnnotationResult,
  type ImageStudioModelSettings,
  type ImageStudioPromptRefinement,
  type ImageStudioReference,
  type InspirationTab,
  type ReferenceAnnotation,
  type UploadedReference,
} from './constants';
import {
  buildImageStudioGeneratePayload,
  buildImageStudioRefinePayload,
  type ImageStudioGeneratePayload,
  type ImageStudioRefinePayload,
} from './requestInputs';
import { useImageTemplateFilters } from './useImageTemplateFilters';

export interface ImageStudioWorkspaceControllerProps {
  initialPrompt?: string;
  initialUploadedRefs?: UploadedReference[];
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
  onGenerate: (payload: ImageStudioGeneratePayload) => void;
  onRefinePrompt?: (payload: ImageStudioRefinePayload) => Promise<ImageStudioPromptRefinement>;
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

export function useImageStudioWorkspaceController({
  initialPrompt,
  initialUploadedRefs = [],
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
}: ImageStudioWorkspaceControllerProps) {
  const t = useTranslations('imageStudio');
  useTranslations('imageStudio.stylePresets');
  const uploadedRefLabel = t('panel.refSection.uploadedLabel');
  // Seed once from the public-generator draft; later user edits are preserved
  // because the useState initializer only runs on first mount.
  const [prompt, setPrompt] = useState(initialPrompt ?? '');
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
  const router = useRouter();
  const initialUploadsAppliedRef = useRef(false);

  const selectedModel = imageModels.find((m) => m.id === selectedModelId);
  const chatModels = availableModels.filter((m) => hasChatCapability(m.capabilities ?? []));
  const selectedChatModel = chatModels.find((m) => m.id === selectedChatModelId);

  // image_generation 的 TaskModel 列表（paramsSchema/pricingSchema/multiplier/
  // discountFactor，spec §5.1）独立于 imageModels（ModelConfigItem，驱动模型选择器/
  // capability 检测等既有逻辑）单独拉取，只按 modelConfigId 关联给设置面板用。
  const [imageTaskModels, setImageTaskModels] = useState<TaskModel[]>([]);
  useEffect(() => {
    let cancelled = false;
    pricingActions
      .getTaskModels('image_generation')
      .then((models) => {
        if (!cancelled) setImageTaskModels(models);
      })
      .catch(() => {
        if (!cancelled) setImageTaskModels([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const selectedImageTaskModel = imageTaskModels.find((m) => m.modelConfigId === selectedModelId);

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

  const originalPromptForImage = useMemo(
    () =>
      buildImageWorkbenchPrompt(prompt, settings, capability, {
        includePromptTuning: false,
      }).prompt,
    [prompt, settings.stylePreset, settings.negativePrompt, capability],
  );
  const finalPrompt = originalPromptForImage.trim();
  // phase-3 review Finding 2: ImageStudioSettingsPanel already shows a "generation disabled"
  // banner when the selected task-model's schema hasn't loaded (`!paramsSchema || !pricingSchema`),
  // but this gate previously ignored schema state entirely, so Generate stayed clickable.
  const hasImagePricingSchema = Boolean(
    selectedImageTaskModel?.paramsSchema && selectedImageTaskModel?.pricingSchema,
  );
  const canGenerate = finalPrompt.length > 0 && hasImagePricingSchema;
  const canRefine = Boolean(onRefinePrompt && prompt.trim() && !isRefining && !isGenerating);
  const displayedTemplateName = activeTemplateName ?? appliedTemplateName;

  useEffect(() => {
    if (!selectedModelId && imageModels[0]?.id) onModelChange(imageModels[0].id);
  }, [imageModels, onModelChange, selectedModelId]);

  useEffect(() => {
    if (initialUploadsAppliedRef.current || initialUploadedRefs.length === 0) return;
    initialUploadsAppliedRef.current = true;
    setUploadedRefs(
      initialUploadedRefs.slice(-8).map((ref) => ({
        ...ref,
        label: uploadedRefLabel,
      })),
    );
  }, [initialUploadedRefs, uploadedRefLabel]);

  const resetRefinement = () => {
    setRefineMeta(null);
    setRefineError(null);
  };

  const removeReferenceAnnotation = (url: string) => {
    const fallbackPrefix = `url:${url}:`;
    setReferenceAnnotations((prev) => {
      const matchingKeys = Object.keys(prev).filter((key) => key === url || key.startsWith(fallbackPrefix));
      if (matchingKeys.length === 0) return prev;
      const rest = { ...prev };
      for (const key of matchingKeys) delete rest[key];
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
      ...urls.map((url, index) => ({
        url,
        label: uploadedRefLabel,
        annotationKey: `upload:${Date.now()}:${index}`,
      })),
    ].slice(-8));
    resetRefinement();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleGenerate = () => {
    if (!canGenerate || isGenerating) return;
    onGenerate(buildImageStudioGeneratePayload({
      finalPrompt,
      selectedSourceImages,
      uploadedRefs,
      referenceAnnotations,
    }));
  };

  const handleRefinePrompt = async () => {
    if (!canRefine || !onRefinePrompt) return;
    setIsRefining(true);
    setRefineError(null);
    try {
      const payload = buildImageStudioRefinePayload({
        prompt,
        selectedSourceImages,
        uploadedRefs,
        referenceAnnotations,
      });
      const result = await onRefinePrompt(payload);
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
      (item.referenceImages ?? []).map((ref, index) => ({
        url: ref.url,
        label: uploadedRefLabel,
        annotationKey: resolveReferenceAnnotationKey(ref, index),
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
    const previousNote = referenceAnnotations[result.targetKey]?.note;
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
      [result.targetKey]: {
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

  const openUploadDialog = () => fileInputRef.current?.click();

  const openDrawWorkspace = (image: ImageResultItem) => {
    const params = new URLSearchParams({ imageUrl: image.url });
    if (image.prompt) params.set('prompt', image.prompt);
    router.push(`/draw?${params.toString()}`);
  };

  return {
    t,
    fileInputRef,
    promptTextareaRef,
    previewElement,
    annotationTarget,
    setAnnotationTarget,
    handleUseAnnotation,
    handleUpload,
    openUploadDialog,
    settingsOpen,
    inspirationOpen,
    setSettingsOpen,
    setInspirationOpen,
    settingsPanelProps: {
      open: settingsOpen,
      taskType: 'image_generation',
      modelConfigId: selectedModelId ?? undefined,
      paramsSchema: selectedImageTaskModel?.paramsSchema as unknown as ParamsSchema | undefined,
      pricingSchema: selectedImageTaskModel?.pricingSchema as unknown as PricingSchema | undefined,
      pricingContext: {
        multiplier: selectedImageTaskModel?.multiplier ?? 1,
        discountFactor: selectedImageTaskModel?.discountFactor ?? 1,
      },
      settings,
      capability,
      onClose: () => setSettingsOpen(false),
      // 显式的 schema<->settings 映射层（task 7 review CRITICAL 2）：resolution/
      // quantity 改名到 size/count 且 resolution 还要做真实取值换算，quality 原样
      // 传递，见 schema-params-mapping.ts 顶部注释里的 source of truth。不再是盲
      // cast，orphan key 不会再悄悄丢参数。
      onParamsChange: (params: Record<string, unknown>) =>
        updateSettings(schemaParamsToImageSettings(params, settings.size, capability)),
      onSettingsChange: updateSettings,
    },
    headerProps: {
      activeTemplateName,
      displayedTemplateName,
      onOpenSettings: () => setSettingsOpen(true),
      onOpenInspiration: () => setInspirationOpen(true),
      onOpenTemplateEditor,
    },
    resultsPanelProps: {
      images: latestImages,
      isGenerating,
      onPreview: (image: ImageResultItem) => openPreview(image.url, image.prompt),
      onUseAsSource: onSelectSourceImage,
      onOpenDraw: openDrawWorkspace,
      onSubmitFeedback,
      onAddToMaterial: handleAddImageToMaterial,
    },
    referencesPanelProps: {
      selectedSourceImages,
      uploadedRefs,
      referenceAnnotations,
      onPreview: openPreview,
      onAnnotate: setAnnotationTarget,
      onRemoveSourceImage: (image: ImageStudioReference, index: number) => {
        onRemoveSourceImage(index);
        removeReferenceAnnotation(resolveReferenceAnnotationKey(image, index));
        resetRefinement();
      },
      onRemoveUploadedRef: (ref: UploadedReference, index: number) => {
        setUploadedRefs((prev) => prev.filter((_, i) => i !== index));
        removeReferenceAnnotation(resolveReferenceAnnotationKey(ref, index));
        resetRefinement();
      },
      onClearAll: () => {
        onClearSourceImages();
        setUploadedRefs([]);
        setReferenceAnnotations({});
        resetRefinement();
      },
    },
    promptPanelProps: {
      prompt,
      onPromptChange: (value: string) => {
        if (displayedTemplateName) clearTemplate();
        setPrompt(value);
        resetRefinement();
      },
      promptTextareaRef,
      imageModels,
      selectedModelId,
      selectedModel,
      onModelChange,
      chatModels,
      selectedChatModelId,
      selectedChatModel,
      onChatModelChange,
      settings,
      onPromptTuningChange: (promptTuning: string) => updateSettings({ promptTuning }),
      capability,
      displayedTemplateName,
      onClearTemplate: clearTemplate,
      onUploadClick: openUploadDialog,
      onPasteFiles: (files: FileList | null) => void handleUpload(files),
      canGenerate,
      isGenerating,
      canRefine,
      isRefining,
      onRefinePrompt: () => void handleRefinePrompt(),
      onGenerate: handleGenerate,
      selectedSourceCount: selectedSourceImages.length,
      estimatingGenerateCost,
      estimatedGenerateCost,
      refineError,
      refineMeta,
      onUndoRefine: () => {
        if (!refineMeta) return;
        setPrompt(refineMeta.before);
        resetRefinement();
      },
    },
    inspirationPanelProps: {
      tab: inspirationTab,
      onTabChange: setInspirationTab,
      onClose: () => setInspirationOpen(false),
      historyItems,
      materialImages,
      materialsLoading,
      templates: filteredTemplates,
      templatesLoading,
      templateSearch,
      onTemplateSearchChange: setTemplateSearch,
      templateCategory,
      onTemplateCategoryChange: setTemplateCategory,
      templateSort,
      onTemplateSortChange: setTemplateSort,
      templateCategories,
      selectedSourceUrls,
      onPreviewImage: (image: ImageResultItem) => openPreview(image.url, image.prompt),
      onPreviewMaterial: (asset: MaterialAsset) => openPreview(asset.url, asset.title),
      onUseHistoryImage: handleSelectHistoryImage,
      onApplyHistoryTask: handleApplyHistoryTask,
      onAddImageToMaterial: onAddImageToMaterial ? handleAddImageToMaterial : undefined,
      onDeleteHistoryTask: onDeleteHistoryTask ? (item: ImageWorkbenchHistoryItem) => void handleDeleteHistoryTask(item) : undefined,
      onUseMaterial: (asset: MaterialAsset) => void handleSelectMaterialImage(asset),
      onDeleteMaterial: onDeleteMaterialImage ? (asset: MaterialAsset) => void handleDeleteMaterialImage(asset) : undefined,
      onApplyTemplate: handleApplyTemplate,
    },
  };
}
