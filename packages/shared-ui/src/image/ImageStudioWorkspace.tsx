'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  type MaterialAsset,
  type ImageTemplate,
  type ModelConfigItem,
} from '@autix/shared-lib';
import {
  detectImageModelKind,
  IMAGE_MODEL_CAPABILITIES,
} from '@autix/shared-lib/image-capabilities';
import { coerceClientSettings } from '@autix/shared-lib/image-coerce';
import { buildImageWorkbenchPrompt } from '@autix/shared-lib/image-prompt';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { ModelPickerPopover } from '../chat/ModelPickerPopover';
import { useImagePreview } from '../chat/ImagePreview';
import { cn } from '../ui/utils';
import type { ImageResultItem } from '../chat/MessageBubble';
import {
  PROMPT_TUNING_OPTIONS,
  STYLE_PRESETS,
  TEMPLATE_SORT_OPTIONS,
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
  HistoryImageCard,
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
  historyImages: ImageResultItem[];
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
  onDeleteHistoryImage?: (image: ImageResultItem) => Promise<void> | void;
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
  historyImages,
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
  onDeleteHistoryImage,
  onSelectMaterialImage,
  onDeleteMaterialImage,
}: ImageStudioWorkspaceProps) {
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
      toast.info(`已根据模型自动调整：${changed.join('、')}`);
    }
  }, [capability.kind]);

  const provider = modelProviderLabel(selectedModel);
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
      ...urls.map((url) => ({ url, label: '上传参考' as const })),
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
      setRefineError(err instanceof Error ? err.message : '提示词润色失败');
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
      toast.info('已在编辑区');
      return;
    }
    onSelectSourceImage?.(image);
    setInspirationOpen(false);
    resetRefinement();
    toast.success('已加入编辑区，可放大标注或继续改图');
  };

  const handleSelectMaterialImage = async (asset: MaterialAsset) => {
    if (!onSelectMaterialImage) return;
    try {
      await onSelectMaterialImage(asset);
      setInspirationOpen(false);
      resetRefinement();
      toast.success('素材已加入编辑区');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '当前无法使用素材');
    }
  };

  const handleDeleteMaterialImage = async (asset: MaterialAsset) => {
    if (!onDeleteMaterialImage) return;
    try {
      await onDeleteMaterialImage(asset);
      toast.success('素材已删除');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '素材删除失败');
    }
  };

  const handleAddImageToMaterial = async (image: ImageResultItem) => {
    if (!onAddImageToMaterial) return;
    try {
      await onAddImageToMaterial(image);
      toast.success('已加入素材库');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '加入素材库失败');
    }
  };

  const handleDeleteHistoryImage = async (image: ImageResultItem) => {
    if (!onDeleteHistoryImage) return;
    try {
      await onDeleteHistoryImage(image);
      toast.success('历史记录已删除');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除历史记录失败');
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
      throw new Error('当前图片无法合成标注，请下载后重新上传再标注');
    }
    setReferenceAnnotations((prev) => ({
      ...prev,
      [result.targetUrl]: {
        overlayUrl: result.overlayUrl,
        mergedUrl,
        note: result.note,
      },
    }));
    setPrompt((prev) => appendEditablePromptNote(prev, result.note, previousNote));
    setAnnotationTarget(null);
    resetRefinement();
    window.setTimeout(() => {
      const textarea = promptTextareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }, 0);
    toast.success('已写入提示词，可继续编辑');
  };

  return (
    <div className="flex h-full min-w-0 bg-background text-foreground">
      {settingsOpen && (
        <button
          type="button"
          aria-label="关闭参数面板"
          className="fixed inset-0 z-30 bg-background/65 backdrop-blur-sm lg:hidden"
          onClick={() => setSettingsOpen(false)}
        />
      )}
      {inspirationOpen && (
        <button
          type="button"
          aria-label="关闭灵感库"
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
              <h2 className="truncate text-sm font-semibold">图片工作台</h2>
              <p className="truncate text-xs text-muted-foreground">{provider} 参数面板</p>
            </div>
            <button
              type="button"
              aria-label="关闭参数面板"
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
              <PanelLabel icon={<Images className="size-3.5" />} label="尺寸" />
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
              <PanelLabel icon={<SlidersHorizontal className="size-3.5" />} label={capability.qualities.length > 0 ? '质量与数量' : '生成数量'} />
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
                    {count} 张
                  </ChipButton>
                ))}
              </div>
            </section>

            {capability.showAdvancedSliders && (
              <section className="space-y-3">
                <PanelLabel icon={<SlidersHorizontal className="size-3.5" />} label="高级参数" />
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
                  placeholder="Seed，留空为随机"
                  value={settings.seed}
                  onChange={(e) => updateSettings({ seed: e.target.value })}
                />
              </section>
            )}

            <section className="space-y-2">
              <PanelLabel icon={<Wand2 className="size-3.5" />} label="风格与负向词" />
              <SelectLike
                value={settings.stylePreset}
                options={STYLE_PRESETS.map((value) => ({ label: value, value }))}
                onChange={(stylePreset) => updateSettings({ stylePreset })}
              />
              {capability.supportsNegativePrompt !== 'none' && (
                <div className="space-y-1">
                  <textarea
                    className="min-h-20 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-xs leading-5 outline-none placeholder:text-muted-foreground focus:border-primary"
                    placeholder="负向词，例如：低清晰度、畸形手指、过度锐化"
                    value={settings.negativePrompt}
                    onChange={(e) => updateSettings({ negativePrompt: e.target.value })}
                  />
                  {capability.supportsNegativePrompt === 'prompt-injected' && settings.negativePrompt.trim() && (
                    <p className="text-[11px] text-muted-foreground">
                      该模型不支持原生反向提示词，将以"避免: …"嵌入提示词，效果有限
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
            <h1 className="truncate text-sm font-semibold">专业图片生成</h1>
            <p className="truncate text-xs text-muted-foreground">
              GPT / Gemini / 兼容图片模型统一参数与 Prompt 微调
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 lg:hidden" onClick={() => setSettingsOpen(true)}>
              <SlidersHorizontal className="size-3.5" />
              <span className="hidden sm:inline">参数</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 xl:hidden"
              onClick={() => setInspirationOpen(true)}
            >
              <ImageIcon className="size-3.5" />
              <span className="hidden sm:inline">{displayedTemplateName ?? '灵感库'}</span>
            </Button>
            {activeTemplateName && onOpenTemplateEditor && (
              <Button variant="ghost" size="sm" onClick={onOpenTemplateEditor}>
                变量
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
                    <h2 className="text-sm font-semibold">生成结果</h2>
                    <p className="text-xs text-muted-foreground">
                      可预览、下载、复制地址，或送回编辑源继续迭代
                    </p>
                  </div>
                  {isGenerating && (
                    <div className="flex items-center gap-2 rounded-md bg-primary/10 px-2.5 py-1 text-xs text-primary">
                      <Loader2 className="size-3.5 animate-spin" />
                      生成中
                    </div>
                  )}
                </div>

                {latestImages.length === 0 ? (
                  <div className="flex min-h-[280px] flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-center">
                    <ImageIcon className="mb-3 size-10 text-muted-foreground/55" />
                    <p className="text-sm font-medium">还没有图片结果</p>
                    <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                      填写提示词并选择模型后，本次生成的结果会显示在这里。
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
                      <h2 className="text-sm font-semibold">参考与编辑素材</h2>
                      <p className="text-xs text-muted-foreground">标注会显示在原图上，发送时合并为一张图</p>
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
                        label="编辑源"
                        annotationOverlayUrl={referenceAnnotations[image.url]?.overlayUrl}
                        onPreview={() => openPreview(image.url, image.prompt)}
                        onAnnotate={() =>
                          setAnnotationTarget({
                            url: image.url,
                            prompt: image.prompt,
                            label: '编辑源标注',
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
                            label: `${ref.label}标注`,
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
                    <h2 className="text-sm font-semibold">提示词</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>输入创意、商业诉求或编辑指令</span>
                      {displayedTemplateName && (
                        <button
                          type="button"
                          className="inline-flex min-w-0 items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
                          onClick={clearTemplate}
                          title="移除当前模板"
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
                              图片模型 · {selectedModel?.name ?? '选择图片模型'}
                            </span>
                            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                          </button>
                        }
                      />
                    ) : (
                      <div className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground sm:col-span-2">
                        暂无图片模型，请先在模型配置里添加 GPT Image、Gemini 或兼容图片模型。
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
                              Prompt 微调 · {selectedChatModel?.name ?? '默认'}
                            </span>
                            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                          </button>
                        }
                      />
                    )}
                  </div>
                </div>
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{settings.size}</span>
                  <span>{settings.quality}</span>
                  <span>{settings.count}张</span>
                </div>
                <textarea
                  ref={promptTextareaRef}
                  className="min-h-44 w-full resize-y rounded-md border border-border bg-background px-3 py-3 text-sm leading-6 outline-none placeholder:text-muted-foreground focus:border-primary"
                  placeholder="描述你想生成的图片。可以写中文，工作台会结合模型、风格、负向词和参考图生成最终请求。"
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
                      title={capability.supportsReferenceImage ? undefined : '当前模型不支持参考图'}
                    >
                      <Upload className="size-4" />
                      上传参考图
                    </button>
                    <div className="w-[150px] shrink-0">
                      <SelectLike
                        value={settings.promptTuning}
                        options={PROMPT_TUNING_OPTIONS.map((value) => ({ label: value, value }))}
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
                      AI 润色
                    </button>
                  </div>
                  <Button
                    className="h-10 rounded-lg px-5 sm:justify-self-end"
                    onClick={handleGenerate}
                    disabled={!canGenerate || isGenerating || imageModels.length === 0}
                  >
                    {isGenerating ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    <span>{selectedSourceImages.length > 0 ? '开始编辑' : '开始生图'}</span>
                    {estimatingGenerateCost ? (
                      <span className="text-xs opacity-80">估算中</span>
                    ) : estimatedGenerateCost != null ? (
                      <span className="text-xs opacity-90">{estimatedGenerateCost} 积分</span>
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
                    <span>已用 {settings.promptTuning} 润色，可继续在上方编辑。</span>
                    <div className="flex items-center gap-2">
                      {refineMeta.result.composedPrompt !== refineMeta.result.originalPrompt && (
                        <details className="relative">
                          <summary className="cursor-pointer text-primary/80 hover:text-primary">
                            查看上下文
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
                        撤回润色
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
                  <h2 className="text-sm font-semibold">灵感库</h2>
                  <p className="text-xs text-muted-foreground">生成资产与热门图片模板</p>
                </div>
                <button
                  type="button"
                  aria-label="关闭灵感库"
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
                  历史产物
                </TabButton>
                <TabButton
                  active={inspirationTab === 'materials'}
                  onClick={() => setInspirationTab('materials')}
                  icon={<Upload className="size-3.5" />}
                >
                  素材库
                </TabButton>
                <TabButton
                  active={inspirationTab === 'templates'}
                  onClick={() => setInspirationTab('templates')}
                  icon={<LayoutTemplate className="size-3.5" />}
                >
                  热门模板
                </TabButton>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {inspirationTab === 'history' ? (
                historyImages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-border px-8 text-center">
                    <Images className="mb-2 size-8 text-muted-foreground/60" />
                    <p className="text-xs text-muted-foreground">生成图片后会自动进入历史产物</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {historyImages.map((image, index) => (
                      <HistoryImageCard
                        key={`${image.url}-${index}`}
                        image={image}
                        index={index}
                        selected={selectedSourceUrls.has(image.url)}
                        onPreview={() => openPreview(image.url, image.prompt)}
                        onUseAsSource={() => handleSelectHistoryImage(image)}
                        onAddToMaterial={() => handleAddImageToMaterial(image)}
                        onDelete={() => handleDeleteHistoryImage(image)}
                      />
                    ))}
                  </div>
                )
              ) : inspirationTab === 'materials' ? (
                materialsLoading ? (
                  <div className="flex items-center justify-center rounded-lg border border-dashed border-border py-12 text-xs text-muted-foreground">
                    <Loader2 className="mr-2 size-3.5 animate-spin" />
                    正在加载素材库
                  </div>
                ) : materialImages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-border px-8 text-center">
                    <Upload className="mb-2 size-8 text-muted-foreground/60" />
                    <p className="text-xs text-muted-foreground">素材库中的图片会显示在这里</p>
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
                        placeholder="搜索模板、标签或用途"
                        value={templateSearch}
                        onChange={(e) => setTemplateSearch(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <SelectLike
                        value={templateCategory}
                        options={[
                          { label: '全部分类', value: 'all' },
                          ...templateCategories.map((category) => ({ label: category, value: category })),
                        ]}
                        onChange={setTemplateCategory}
                      />
                      <SelectLike
                        value={templateSort}
                        options={TEMPLATE_SORT_OPTIONS}
                        onChange={setTemplateSort}
                      />
                    </div>
                  </div>

                  {templatesLoading ? (
                    <div className="flex items-center justify-center rounded-lg border border-dashed border-border py-12 text-xs text-muted-foreground">
                      <Loader2 className="mr-2 size-3.5 animate-spin" />
                      正在加载热门模板
                    </div>
                  ) : filteredTemplates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-8 py-12 text-center">
                      <LayoutTemplate className="mb-2 size-8 text-muted-foreground/60" />
                      <p className="text-xs text-muted-foreground">暂无匹配模板</p>
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
        title="上传参考图"
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
