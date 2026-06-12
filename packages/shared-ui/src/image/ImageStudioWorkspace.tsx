'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Brush,
  ChevronDown,
  Copy,
  Download,
  ImageIcon,
  Images,
  LayoutTemplate,
  Loader2,
  Maximize2,
  PencilLine,
  RefreshCcw,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { ModelPickerPopover } from '../chat/ModelPickerPopover';
import { useImagePreview } from '../chat/ImagePreview';
import { cn } from '../ui/utils';
import type { ImageResultItem } from '../chat/MessageBubble';

export interface ImageStudioReference {
  url: string;
  prompt?: string;
  generationId?: string;
  index?: number;
}

export interface ImageStudioModelSettings {
  size: string;
  quality: string;
  count: number;
  guidanceScale: number;
  steps: number;
  seed: string;
  promptTuning: string;
  stylePreset: string;
  negativePrompt: string;
}

export interface ImageStudioPromptRefinement {
  originalPrompt: string;
  composedPrompt: string;
  refinedPrompt: string;
  additions: string[];
  model?: string;
  chatModel?: string;
}

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
  imageTemplates?: ImageTemplate[];
  templatesLoading?: boolean;
  isGenerating: boolean;
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
}

interface AnnotationTarget {
  url: string;
  prompt?: string;
  label: string;
  overlayUrl?: string;
}

interface ImageAnnotationResult {
  targetUrl: string;
  overlayUrl: string;
  mergedUrl?: string;
  note: string;
}

interface ReferenceAnnotation {
  overlayUrl: string;
  mergedUrl: string;
  note: string;
}

interface UploadedReference {
  url: string;
  label: '上传参考';
}

interface AnnotationBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface MarkHistoryEntry {
  imageData: ImageData;
  bounds: AnnotationBounds | null;
}

const STYLE_PRESETS = [
  '通用精修',
  '商业摄影',
  '电影感',
  '产品海报',
  '国风插画',
  '室内空间',
  '角色设定',
  '表情包',
];

const PROMPT_TUNING_OPTIONS = [
  '自动优化',
  '忠实原文',
  '摄影级细节',
  '电商卖点',
  '故事氛围',
  '极简构图',
];

const TEMPLATE_SORT_OPTIONS = [
  { label: '热门优先', value: 'popular' },
  { label: '最新发布', value: 'newest' },
  { label: '收藏最多', value: 'likes' },
];

const promptToolbarControlClass =
  'inline-flex h-10 w-[150px] shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium shadow-none transition-colors';

const ANNOTATION_COLORS = [
  { label: '红色', value: 'rgba(255, 60, 60, 0.88)', swatch: '#ff3c3c' },
  { label: '黄色', value: 'rgba(250, 204, 21, 0.9)', swatch: '#facc15' },
  { label: '青色', value: 'rgba(34, 211, 238, 0.9)', swatch: '#22d3ee' },
  { label: '绿色', value: 'rgba(74, 222, 128, 0.9)', swatch: '#4ade80' },
  { label: '紫色', value: 'rgba(168, 85, 247, 0.9)', swatch: '#a855f7' },
  { label: '白色', value: 'rgba(255, 255, 255, 0.92)', swatch: '#ffffff' },
];

type InspirationTab = 'history' | 'templates';

function readFilesAsDataUrls(files: File[]) {
  return Promise.all(
    files.map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result ?? ''));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        }),
    ),
  );
}

function modelProviderLabel(model?: ModelConfigItem | null) {
  if (!model) return '未选择';
  const raw = `${model.provider} ${model.model}`.toLowerCase();
  if (raw.includes('gemini')) return 'Gemini';
  if (raw.includes('gpt') || raw.includes('openai')) return 'GPT Image';
  if (raw.includes('dall')) return 'DALL-E';
  return model.provider || model.type || 'Image';
}

function resolveTemplatePrompt(template: ImageTemplate) {
  let nextPrompt = template.prompt ?? '';
  for (const variable of template.variables ?? []) {
    const fallback = variable.default || variable.label || variable.key;
    nextPrompt = nextPrompt.replaceAll(`{{${variable.key}}}`, fallback);
  }
  return nextPrompt.trim();
}

function cloneAnnotationBounds(bounds: AnnotationBounds | null): AnnotationBounds | null {
  return bounds ? { ...bounds } : null;
}

function mergeAnnotationBounds(boundsList: AnnotationBounds[]): AnnotationBounds | null {
  if (boundsList.length === 0) return null;
  return boundsList.reduce<AnnotationBounds>(
    (merged, bounds) => ({
      minX: Math.min(merged.minX, bounds.minX),
      minY: Math.min(merged.minY, bounds.minY),
      maxX: Math.max(merged.maxX, bounds.maxX),
      maxY: Math.max(merged.maxY, bounds.maxY),
    }),
    { ...boundsList[0] },
  );
}

function describeAnnotationPosition(bounds: AnnotationBounds, width: number, height: number) {
  const centerX = ((bounds.minX + bounds.maxX) / 2) / Math.max(width, 1);
  const centerY = ((bounds.minY + bounds.maxY) / 2) / Math.max(height, 1);
  const horizontal = centerX < 0.33 ? '左侧' : centerX > 0.67 ? '右侧' : '中部';
  const vertical = centerY < 0.33 ? '上方' : centerY > 0.67 ? '下方' : '中部';

  if (horizontal === '中部' && vertical === '中部') return '画面中部';
  if (horizontal === '中部') return `画面${vertical}`;
  if (vertical === '中部') return `画面${horizontal}`;
  return `画面${vertical}${horizontal}`;
}

function buildAnnotationPromptNote(
  label: string,
  regions: AnnotationBounds[],
  width: number,
  height: number,
) {
  const cleanLabel = label.replace(/标注$/, '');
  const firstRegion = regions[0];
  if (!firstRegion) {
    return `【标注说明】图片：${cleanLabel}。请优先处理标注区域，未标注区域尽量保持原图一致。`;
  }
  const describeRegion = (bounds: AnnotationBounds, index?: number) => {
    const position = describeAnnotationPosition(bounds, width, height);
    const widthPercent = Math.max(1, Math.round(((bounds.maxX - bounds.minX) / Math.max(width, 1)) * 100));
    const heightPercent = Math.max(1, Math.round(((bounds.maxY - bounds.minY) / Math.max(height, 1)) * 100));
    const prefix = typeof index === 'number' ? `区域 ${index + 1}：` : '';
    return `${prefix}${position}，覆盖范围约为画面宽度 ${widthPercent}%、高度 ${heightPercent}%`;
  };

  if (regions.length <= 1) {
    return `【标注说明】图片：${cleanLabel}。标注区域：${describeRegion(firstRegion)}。请优先处理这块标注区域，未标注区域尽量保持原图一致。`;
  }

  return `【标注说明】图片：${cleanLabel}。标注区域共 ${regions.length} 处：${regions.map(describeRegion).join('；')}。请分别处理这些标注区域，未标注区域尽量保持原图一致。`;
}

function appendEditablePromptNote(prompt: string, note: string, previousNote?: string) {
  const normalizedPrompt = previousNote
    ? prompt.replace(previousNote, '').replace(/\n{3,}/g, '\n\n').trimEnd()
    : prompt.trimEnd();
  const trimmed = normalizedPrompt.trimEnd();
  if (!trimmed) {
    return `${note}\n请继续补充希望 AI 如何修改这个区域。`;
  }
  return `${trimmed}\n\n${note}`;
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
  imageTemplates = [],
  templatesLoading = false,
  isGenerating,
  onGenerate,
  onRefinePrompt,
  onMergeAnnotation,
  onSelectSourceImage,
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
  const { openPreview, element: previewElement } = useImagePreview();

  const selectedModel = imageModels.find((m) => m.id === selectedModelId);
  const chatModels = availableModels.filter((m) => hasChatCapability(m.capabilities ?? []));

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
  };

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
              <PanelLabel icon={<Sparkles className="size-3.5" />} label="模型" />
              {imageModels.length > 0 ? (
                <ModelPickerPopover
                  candidates={imageModels}
                  value={selectedModelId}
                  onChange={(id) => id && onModelChange(id)}
                  memoryKey="image-studio"
                  disabledClear
                  trigger={
                    <button
                      type="button"
                      className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-3 text-left text-xs transition-colors hover:bg-accent"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {selectedModel?.name ?? '选择图片模型'}
                      </span>
                      <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  }
                />
              ) : (
                <div className="rounded-md border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
                  暂无图片模型，请先在模型配置里添加 GPT Image、Gemini 或兼容图片模型。
                </div>
              )}
              {chatModels.length > 0 && (
                <ModelPickerPopover
                  candidates={chatModels}
                  value={selectedChatModelId}
                  onChange={onChatModelChange}
                  memoryKey="image-studio-chat"
                  disabledClear={false}
                  trigger={
                    <button
                      type="button"
                      className="flex h-8 w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-3 text-left text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        Prompt 微调模型: {chatModels.find((m) => m.id === selectedChatModelId)?.name ?? '默认'}
                      </span>
                      <ChevronDown className="size-3 shrink-0" />
                    </button>
                  }
                />
              )}
            </section>

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
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
              <section className="rounded-lg border border-border bg-card p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold">提示词</h2>
                    <p className="text-xs text-muted-foreground">输入创意、商业诉求或编辑指令</p>
                  </div>
                  <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
                    <span>{settings.size}</span>
                    <span>{settings.quality}</span>
                    <span>{settings.count}张</span>
                  </div>
                </div>
                <textarea
                  ref={promptTextareaRef}
                  className="min-h-44 w-full resize-y rounded-md border border-border bg-background px-3 py-3 text-sm leading-6 outline-none placeholder:text-muted-foreground focus:border-primary"
                  placeholder="描述你想生成的图片。可以写中文，工作台会结合模型、风格、负向词和参考图生成最终请求。"
                  value={prompt}
                  onChange={(e) => {
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
                    {selectedSourceImages.length > 0 ? '开始编辑' : '开始生图'}
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

              <section className="min-h-[360px] rounded-lg border border-border bg-card p-4">
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
                  <div className="flex min-h-[280px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-center">
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
                      />
                    ))}
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
              <div className="grid grid-cols-2 gap-1 rounded-md border border-border bg-background p-1">
                <TabButton
                  active={inspirationTab === 'history'}
                  onClick={() => setInspirationTab('history')}
                  icon={<Images className="size-3.5" />}
                >
                  历史产物
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

function PanelLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      {icon}
      <span>{label}</span>
    </div>
  );
}

function ChipButton({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        'h-8 rounded-md border px-2 text-xs transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid grid-cols-[44px_1fr_46px] items-center gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
      <span className="rounded border border-border bg-background px-1.5 py-1 text-center text-[11px]">
        {value}
      </span>
    </label>
  );
}

function SelectLike({
  value,
  options,
  onChange,
  compact = false,
  className,
}: {
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
  compact?: boolean;
  className?: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={onChange}
    >
      <SelectTrigger className={cn(
        'w-full border-border bg-background px-3 text-xs shadow-none',
        compact ? 'h-8' : 'h-9',
        className,
      )}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" className="z-[70] rounded-lg">
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className="text-xs">
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TabButton({
  active,
  icon,
  onClick,
  children,
}: {
  active: boolean;
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-8 items-center justify-center gap-1.5 rounded px-2 text-xs transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
      onClick={onClick}
    >
      {icon}
      {children}
    </button>
  );
}

function ImageTemplateCard({
  template,
  onApply,
}: {
  template: ImageTemplate;
  onApply: () => void;
}) {
  const cover = template.coverImage || template.exampleImages?.[0];
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background transition-colors hover:border-primary/45">
      <div className="flex gap-3 p-2.5">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
          {cover ? (
            <img src={cover} alt={template.title} className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="size-6 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-start justify-between gap-2">
            <p className="line-clamp-2 text-xs font-medium leading-5">{template.title}</p>
            {template.isHot && (
              <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                热门
              </span>
            )}
          </div>
          <p className="line-clamp-2 text-[11px] leading-4 text-muted-foreground">
            {template.description || template.prompt}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="truncate text-[10px] text-muted-foreground">
              {template.category} · {template.useCount ?? 0} 次使用
            </span>
            <Button size="sm" variant="outline" className="h-7 shrink-0 px-2 text-xs" onClick={onApply}>
              套用
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReferenceThumb({
  url,
  label,
  annotationOverlayUrl,
  onPreview,
  onAnnotate,
  onRemove,
}: {
  url: string;
  label: string;
  annotationOverlayUrl?: string;
  onPreview: () => void;
  onAnnotate: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="group relative aspect-square overflow-hidden rounded-md border border-border bg-muted">
      <button type="button" className="h-full w-full" onClick={onAnnotate} title="放大标注">
        <img src={url} alt="" className="h-full w-full object-cover" />
        {annotationOverlayUrl && (
          <img
            src={annotationOverlayUrl}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          />
        )}
      </button>
      <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
        {label}
      </span>
      {annotationOverlayUrl && (
        <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
          已标注
        </span>
      )}
      <div className="absolute right-1 top-1 hidden gap-1 group-hover:flex">
        <button
          type="button"
          className="inline-flex size-6 items-center justify-center rounded-full bg-background/85 text-muted-foreground shadow-sm hover:text-primary"
          onClick={onAnnotate}
          title="放大标注"
        >
          <PencilLine className="size-3.5" />
        </button>
        <button
          type="button"
          className="inline-flex size-6 items-center justify-center rounded-full bg-background/85 text-muted-foreground shadow-sm hover:text-foreground"
          onClick={onPreview}
          title="预览原图"
        >
          <Maximize2 className="size-3.5" />
        </button>
      </div>
      <button
        type="button"
        className="absolute bottom-1 right-1 hidden size-6 items-center justify-center rounded-full bg-background/85 text-muted-foreground shadow-sm hover:text-destructive group-hover:flex"
        onClick={onRemove}
        title="移除"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

function HistoryImageCard({
  image,
  index,
  selected,
  onPreview,
  onUseAsSource,
}: {
  image: ImageResultItem;
  index: number;
  selected: boolean;
  onPreview: () => void;
  onUseAsSource: () => void;
}) {
  return (
    <div
      className={cn(
        'group overflow-hidden rounded-md border bg-background transition-colors hover:border-primary/45',
        selected ? 'border-primary ring-1 ring-primary/35' : 'border-border',
      )}
    >
      <button
        type="button"
        className="relative block aspect-square w-full overflow-hidden bg-muted"
        onClick={onPreview}
      >
        <img
          src={image.url}
          alt={image.prompt ?? ''}
          className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]"
        />
        <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
          #{index + 1}
        </span>
      </button>
      <div className="grid grid-cols-2 border-t border-border">
        <button
          type="button"
          className={cn(
            'inline-flex h-7 items-center justify-center gap-1 border-r border-border text-[11px] hover:bg-accent hover:text-primary',
            selected ? 'text-primary' : 'text-muted-foreground',
          )}
          onClick={onUseAsSource}
        >
          <RefreshCcw className="size-3" />
          {selected ? '已选' : '编辑'}
        </button>
        <button
          type="button"
          className="inline-flex h-7 items-center justify-center gap-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={onPreview}
        >
          <Maximize2 className="size-3" />
          预览
        </button>
      </div>
    </div>
  );
}

function GeneratedImageCard({
  image,
  onPreview,
  onUseAsSource,
}: {
  image: ImageResultItem;
  onPreview: () => void;
  onUseAsSource: () => void;
}) {
  return (
    <div className="group overflow-hidden rounded-lg border border-border bg-background">
      <button type="button" className="block aspect-square w-full overflow-hidden bg-muted" onClick={onPreview}>
        <img src={image.url} alt={image.prompt ?? ''} className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]" />
      </button>
      <div className="flex items-center justify-between gap-2 px-2 py-2">
        <div className="min-w-0 text-[11px] text-muted-foreground">
          <p className="truncate">{image.prompt ?? 'Generated image'}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <IconAction label="作为编辑源" onClick={onUseAsSource}>
            <RefreshCcw className="size-3.5" />
          </IconAction>
          <IconAction label="预览" onClick={onPreview}>
            <Maximize2 className="size-3.5" />
          </IconAction>
          <IconAction label="复制地址" onClick={() => void navigator.clipboard?.writeText(image.url)}>
            <Copy className="size-3.5" />
          </IconAction>
          <a
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            href={image.url}
            download
            title="下载"
          >
            <Download className="size-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

function ImageAnnotationOverlay({
  target,
  onClose,
  onUse,
}: {
  target: AnnotationTarget;
  onClose: () => void;
  onUse: (result: ImageAnnotationResult) => Promise<void> | void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const markCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const markHistoryRef = useRef<MarkHistoryEntry[]>([]);
  const boundsRef = useRef<AnnotationBounds | null>(null);
  const savingRef = useRef(false);
  const [brushSize, setBrushSize] = useState(18);
  const [brushColor, setBrushColor] = useState(ANNOTATION_COLORS[0].value);
  const [ready, setReady] = useState(false);
  const [hasMarks, setHasMarks] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const setMarkHistory = (entries: MarkHistoryEntry[]) => {
    markHistoryRef.current = entries;
    setCanUndo(entries.length > 1);
  };

  const renderVisibleCanvas = () => {
    const canvas = canvasRef.current;
    const markCanvas = markCanvasRef.current;
    const image = imageRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !markCanvas || !image || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    ctx.drawImage(markCanvas, 0, 0);
  };

  const drawBaseImage = (image: HTMLImageElement) => {
    const canvas = canvasRef.current;
    const markCanvas = markCanvasRef.current;
    if (!canvas || !markCanvas) return;
    const maxWidth = 1200;
    const maxHeight = 760;
    const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight, 1);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.width = width;
    canvas.height = height;
    markCanvas.width = width;
    markCanvas.height = height;
    const ctx = canvas.getContext('2d');
    const markCtx = markCanvas.getContext('2d');
    if (!ctx || !markCtx) return;
    markCtx.clearRect(0, 0, width, height);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    boundsRef.current = null;
    const emptyEntry = { imageData: markCtx.getImageData(0, 0, width, height), bounds: null };
    setMarkHistory([emptyEntry]);
    setHasMarks(false);

    if (!target.overlayUrl) {
      setReady(true);
      return;
    }

    const overlay = new Image();
    overlay.onload = () => {
      markCtx.clearRect(0, 0, width, height);
      markCtx.drawImage(overlay, 0, 0, width, height);
      const bounds = readBoundsFromMarkCanvas(markCanvas);
      boundsRef.current = bounds;
      setHasMarks(Boolean(bounds));
      setMarkHistory(
        bounds
          ? [
              emptyEntry,
              { imageData: markCtx.getImageData(0, 0, width, height), bounds: cloneAnnotationBounds(bounds) },
            ]
          : [emptyEntry],
      );
      renderVisibleCanvas();
      setReady(true);
    };
    overlay.onerror = () => {
      toast.error('历史标注加载失败，可重新标注');
      setReady(true);
    };
    overlay.src = target.overlayUrl;
  };

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setHasMarks(false);
    setCanUndo(false);
    markHistoryRef.current = [];
    boundsRef.current = null;

    const loadImage = (withCors: boolean) => {
      const image = new Image();
      if (withCors) image.crossOrigin = 'anonymous';
      image.onload = () => {
        if (cancelled) return;
        imageRef.current = image;
        drawBaseImage(image);
      };
      image.onerror = () => {
        if (cancelled) return;
        if (withCors) {
          loadImage(false);
          return;
        }
        toast.error('图片加载失败，无法标注');
      };
      image.src = target.url;
    };

    loadImage(/^https?:\/\//.test(target.url));

    return () => {
      cancelled = true;
      imageRef.current = null;
    };
  }, [target.url, target.overlayUrl]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const snapshotMarks = () => {
    const markCanvas = markCanvasRef.current;
    const markCtx = markCanvas?.getContext('2d');
    if (!markCanvas || !markCtx) return;
    markHistoryRef.current = [
      ...markHistoryRef.current.slice(-9),
      {
        imageData: markCtx.getImageData(0, 0, markCanvas.width, markCanvas.height),
        bounds: cloneAnnotationBounds(boundsRef.current),
      },
    ];
    setCanUndo(markHistoryRef.current.length > 1);
  };

  const expandBounds = (point: { x: number; y: number }) => {
    const radius = brushSize / 2;
    const next = {
      minX: Math.max(0, point.x - radius),
      minY: Math.max(0, point.y - radius),
      maxX: point.x + radius,
      maxY: point.y + radius,
    };
    const current = boundsRef.current;
    boundsRef.current = current
      ? {
          minX: Math.min(current.minX, next.minX),
          minY: Math.min(current.minY, next.minY),
          maxX: Math.max(current.maxX, next.maxX),
          maxY: Math.max(current.maxY, next.maxY),
        }
      : next;
  };

  const drawTo = (point: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    const markCanvas = markCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    const markCtx = markCanvas?.getContext('2d');
    const last = lastPointRef.current;
    if (!canvas || !markCanvas || !ctx || !markCtx || !last) return;
    for (const targetCtx of [ctx, markCtx]) {
      targetCtx.lineCap = 'round';
      targetCtx.lineJoin = 'round';
      targetCtx.lineWidth = brushSize;
      targetCtx.strokeStyle = brushColor;
      targetCtx.beginPath();
      targetCtx.moveTo(last.x, last.y);
      targetCtx.lineTo(point.x, point.y);
      targetCtx.stroke();
    }
    expandBounds(last);
    expandBounds(point);
    lastPointRef.current = point;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = getPoint(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    lastPointRef.current = point;
    drawTo({ x: point.x + 0.01, y: point.y + 0.01 });
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const point = getPoint(event);
    if (point) drawTo(point);
  };

  const finishDrawing = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    snapshotMarks();
    setHasMarks(Boolean(boundsRef.current));
  };

  const handleUndo = () => {
    const markCanvas = markCanvasRef.current;
    const markCtx = markCanvas?.getContext('2d');
    if (!markCanvas || !markCtx || markHistoryRef.current.length <= 1) return;
    markHistoryRef.current = markHistoryRef.current.slice(0, -1);
    setCanUndo(markHistoryRef.current.length > 1);
    const previous = markHistoryRef.current[markHistoryRef.current.length - 1];
    if (previous) markCtx.putImageData(previous.imageData, 0, 0);
    boundsRef.current = cloneAnnotationBounds(previous?.bounds ?? null);
    setHasMarks(Boolean(boundsRef.current));
    renderVisibleCanvas();
  };

  const handleClear = () => {
    const markCanvas = markCanvasRef.current;
    const markCtx = markCanvas?.getContext('2d');
    if (!markCanvas || !markCtx) return;
    markCtx.clearRect(0, 0, markCanvas.width, markCanvas.height);
    boundsRef.current = null;
    setMarkHistory([{
      imageData: markCtx.getImageData(0, 0, markCanvas.width, markCanvas.height),
      bounds: null,
    }]);
    setHasMarks(false);
    renderVisibleCanvas();
  };

  const readRegionsFromMarkCanvas = (markCanvas: HTMLCanvasElement): AnnotationBounds[] => {
    const markCtx = markCanvas.getContext('2d');
    if (!markCtx) return [];
    const { data, width, height } = markCtx.getImageData(0, 0, markCanvas.width, markCanvas.height);
    const visited = new Uint8Array(width * height);
    const regions: Array<AnnotationBounds & { pixelCount: number }> = [];
    const stack: number[] = [];
    const isMarked = (index: number) => data[index * 4 + 3] > 0;

    for (let start = 0; start < width * height; start += 1) {
      if (visited[start] || !isMarked(start)) continue;
      visited[start] = 1;
      stack.length = 0;
      stack.push(start);
      let minX = width;
      let minY = height;
      let maxX = 0;
      let maxY = 0;
      let pixelCount = 0;

      while (stack.length > 0) {
        const index = stack.pop();
        if (typeof index !== 'number') break;
        const x = index % width;
        const y = Math.floor(index / width);
        pixelCount += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);

        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) continue;
            const nextX = x + dx;
            const nextY = y + dy;
            if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue;
            const nextIndex = nextY * width + nextX;
            if (visited[nextIndex] || !isMarked(nextIndex)) continue;
            visited[nextIndex] = 1;
            stack.push(nextIndex);
          }
        }
      }

      if (pixelCount >= 8) regions.push({ minX, minY, maxX, maxY, pixelCount });
    }

    return regions
      .sort((a, b) => a.minY - b.minY || a.minX - b.minX)
      .map(({ pixelCount: _pixelCount, ...bounds }) => bounds);
  };

  const readBoundsFromMarkCanvas = (markCanvas: HTMLCanvasElement): AnnotationBounds | null => {
    return mergeAnnotationBounds(readRegionsFromMarkCanvas(markCanvas));
  };

  const handleUse = async () => {
    const markCanvas = markCanvasRef.current;
    if (!markCanvas || savingRef.current || isSaving) return;
    const regions = readRegionsFromMarkCanvas(markCanvas);
    const bounds = mergeAnnotationBounds(regions);
    if (!bounds || regions.length === 0) {
      toast.error('请先圈出需要修改的位置');
      return;
    }
    boundsRef.current = bounds;
    try {
      const overlayUrl = markCanvas.toDataURL('image/png');
      savingRef.current = true;
      setIsSaving(true);
      await onUse({
        targetUrl: target.url,
        overlayUrl,
        note: buildAnnotationPromptNote(target.label, regions, markCanvas.width, markCanvas.height),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '标注合成失败');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[2147483646] flex items-center justify-center bg-black/78 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-lg border border-white/12 bg-background shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{target.label}</h2>
            <p className="truncate text-xs text-muted-foreground">
              {target.prompt || '圈出需要修改、保留或强调的位置'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-9 items-center gap-1 rounded-md border border-border bg-background px-2">
              {ANNOTATION_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  className={cn(
                    'size-5 rounded-full border border-black/15 shadow-sm transition',
                    brushColor === color.value
                      ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                      : 'hover:scale-110',
                  )}
                  style={{ backgroundColor: color.swatch }}
                  title={`标注颜色：${color.label}`}
                  aria-label={`标注颜色：${color.label}`}
                  onClick={() => setBrushColor(color.value)}
                />
              ))}
            </div>
            <label className="flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-xs text-muted-foreground">
              <Brush className="size-3.5" />
              <input
                type="range"
                min={6}
                max={48}
                value={brushSize}
                onChange={(event) => setBrushSize(Number(event.target.value))}
                className="w-24 accent-primary"
              />
            </label>
            <Button variant="outline" size="sm" onClick={handleUndo} disabled={!ready || !canUndo}>
              撤销
            </Button>
            <Button variant="outline" size="sm" onClick={handleClear} disabled={!ready}>
              清空
            </Button>
            <Button
              size="sm"
              onPointerDown={(event) => {
                event.preventDefault();
                void handleUse();
              }}
              onClick={() => void handleUse()}
              disabled={!ready || !hasMarks || isSaving}
            >
              {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              使用标注
            </Button>
            <button
              type="button"
              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={onClose}
              aria-label="关闭"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex flex-1 items-center justify-center overflow-auto bg-black p-3">
          {!ready && (
            <div className="flex items-center gap-2 text-sm text-white/70">
              <Loader2 className="size-4 animate-spin" />
              正在加载图片
            </div>
          )}
          <canvas
            ref={canvasRef}
            className={cn(
              'max-h-[78vh] max-w-full touch-none rounded-md bg-black shadow-lg',
              ready ? 'block cursor-crosshair' : 'hidden',
            )}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishDrawing}
            onPointerCancel={finishDrawing}
            onPointerLeave={finishDrawing}
          />
          <canvas ref={markCanvasRef} className="hidden" />
        </div>
      </div>
    </div>
  );
}

function IconAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      onClick={onClick}
      title={label}
    >
      {children}
    </button>
  );
}
