'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Copy,
  Download,
  ImageIcon,
  Images,
  LayoutTemplate,
  Loader2,
  Maximize2,
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
  generatedImages: ImageResultItem[];
  imageTemplates?: ImageTemplate[];
  templatesLoading?: boolean;
  isGenerating: boolean;
  onGenerate: (payload: {
    promptOverride?: string;
    editInstruction?: string;
    inputImages?: string[];
  }) => void;
  onSelectSourceImage?: (image: ImageResultItem) => void;
}

const SIZE_OPTIONS = [
  { label: '智能比例', value: 'auto' },
  { label: '1:1', value: '1024x1024' },
  { label: '16:9', value: '1792x1024' },
  { label: '9:16', value: '1024x1792' },
  { label: '4:3', value: '1024x768' },
  { label: '3:4', value: '768x1024' },
  { label: '3:2', value: '1536x1024' },
  { label: '2:3', value: '1024x1536' },
];

const QUALITY_OPTIONS = [
  { label: '标准', value: 'standard' },
  { label: '高清', value: 'hd' },
  { label: '自动', value: 'auto' },
];

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

function buildPrompt(base: string, settings: ImageStudioModelSettings) {
  const chunks = [base.trim()];
  if (settings.stylePreset && settings.stylePreset !== '通用精修') {
    chunks.push(`风格方向: ${settings.stylePreset}`);
  }
  if (settings.promptTuning && settings.promptTuning !== '忠实原文') {
    chunks.push(`提示词优化: ${settings.promptTuning}`);
  }
  if (settings.negativePrompt.trim()) {
    chunks.push(`避免: ${settings.negativePrompt.trim()}`);
  }
  if (settings.seed.trim()) {
    chunks.push(`seed: ${settings.seed.trim()}`);
  }
  return chunks.filter(Boolean).join('\n');
}

function resolveTemplatePrompt(template: ImageTemplate) {
  let nextPrompt = template.prompt ?? '';
  for (const variable of template.variables ?? []) {
    const fallback = variable.default || variable.label || variable.key;
    nextPrompt = nextPrompt.replaceAll(`{{${variable.key}}}`, fallback);
  }
  return nextPrompt.trim();
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
  generatedImages,
  imageTemplates = [],
  templatesLoading = false,
  isGenerating,
  onGenerate,
  onSelectSourceImage,
}: ImageStudioWorkspaceProps) {
  const [prompt, setPrompt] = useState('');
  const [uploadedRefs, setUploadedRefs] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inspirationOpen, setInspirationOpen] = useState(false);
  const [inspirationTab, setInspirationTab] = useState<InspirationTab>('history');
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateCategory, setTemplateCategory] = useState('all');
  const [templateSort, setTemplateSort] = useState('popular');
  const [appliedTemplateName, setAppliedTemplateName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { openPreview, element: previewElement } = useImagePreview();

  const selectedModel = imageModels.find((m) => m.id === selectedModelId);
  const chatModels = availableModels.filter((m) => hasChatCapability(m.capabilities ?? []));
  const provider = modelProviderLabel(selectedModel);
  const canGenerate = prompt.trim().length > 0 || selectedSourceImages.length > 0 || uploadedRefs.length > 0;
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

  const updateSettings = (partial: Partial<ImageStudioModelSettings>) => {
    onSettingsChange({ ...settings, ...partial });
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return;
    const urls = await readFilesAsDataUrls(imageFiles);
    setUploadedRefs((prev) => [...prev, ...urls].slice(0, 8));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleGenerate = () => {
    if (!canGenerate || isGenerating) return;
    const tunedPrompt = buildPrompt(prompt, settings);
    onGenerate({
      ...(selectedSourceImages.length > 0
        ? { editInstruction: tunedPrompt }
        : { promptOverride: tunedPrompt }),
      inputImages: uploadedRefs.length > 0 ? uploadedRefs : undefined,
    });
  };

  const handleApplyTemplate = (template: ImageTemplate) => {
    const nextPrompt = resolveTemplatePrompt(template);
    if (nextPrompt) setPrompt(nextPrompt);
    setAppliedTemplateName(template.title);
  };

  const latestImages = generatedImages.slice(-8).reverse();

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
                {SIZE_OPTIONS.map((opt) => (
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
              <PanelLabel icon={<SlidersHorizontal className="size-3.5" />} label="质量与数量" />
              <div className="grid grid-cols-3 gap-2">
                {QUALITY_OPTIONS.map((opt) => (
                  <ChipButton
                    key={opt.value}
                    active={settings.quality === opt.value}
                    onClick={() => updateSettings({ quality: opt.value })}
                  >
                    {opt.label}
                  </ChipButton>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((count) => (
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

            <section className="space-y-2">
              <PanelLabel icon={<Wand2 className="size-3.5" />} label="提示词微调" />
              <SelectLike
                value={settings.promptTuning}
                options={PROMPT_TUNING_OPTIONS.map((value) => ({ label: value, value }))}
                onChange={(promptTuning) => updateSettings({ promptTuning })}
              />
              <SelectLike
                value={settings.stylePreset}
                options={STYLE_PRESETS.map((value) => ({ label: value, value }))}
                onChange={(stylePreset) => updateSettings({ stylePreset })}
              />
              <textarea
                className="min-h-20 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-xs leading-5 outline-none placeholder:text-muted-foreground focus:border-primary"
                placeholder="负向词，例如：低清晰度、畸形手指、过度锐化"
                value={settings.negativePrompt}
                onChange={(e) => updateSettings({ negativePrompt: e.target.value })}
              />
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
                  className="min-h-44 w-full resize-y rounded-md border border-border bg-background px-3 py-3 text-sm leading-6 outline-none placeholder:text-muted-foreground focus:border-primary"
                  placeholder="描述你想生成的图片。可以写中文，工作台会结合模型、风格、负向词和参考图生成最终请求。"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="size-3.5" />
                      上传参考图
                    </button>
                  </div>
                  <Button
                    className="gap-2"
                    onClick={handleGenerate}
                    disabled={!canGenerate || isGenerating || imageModels.length === 0}
                  >
                    {isGenerating ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    {selectedSourceImages.length > 0 ? '开始编辑' : '开始生图'}
                  </Button>
                </div>
              </section>

              {(selectedSourceImages.length > 0 || uploadedRefs.length > 0) && (
                <section className="rounded-lg border border-border bg-card p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-semibold">参考与编辑素材</h2>
                      <p className="text-xs text-muted-foreground">选中的生成图会作为编辑源，上传图会作为参考图</p>
                    </div>
                    <button
                      type="button"
                      className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-destructive"
                      onClick={() => {
                        onClearSourceImages();
                        setUploadedRefs([]);
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
                        onPreview={() => openPreview(image.url, image.prompt)}
                        onRemove={() => onRemoveSourceImage(index)}
                      />
                    ))}
                    {uploadedRefs.map((url, index) => (
                      <ReferenceThumb
                        key={`${url}-${index}`}
                        url={url}
                        label="上传参考"
                        onPreview={() => openPreview(url)}
                        onRemove={() => setUploadedRefs((prev) => prev.filter((_, i) => i !== index))}
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
                      填写提示词并选择模型后，结果会沉淀在这里，也会进入右侧历史库。
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
                generatedImages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-border px-8 text-center">
                    <Images className="mb-2 size-8 text-muted-foreground/60" />
                    <p className="text-xs text-muted-foreground">生成图片后会自动进入灵感库</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {generatedImages.slice().reverse().map((image, index) => (
                      <button
                        key={`${image.url}-${index}`}
                        type="button"
                        className="group relative aspect-square overflow-hidden rounded-md border border-border bg-muted"
                        onClick={() => openPreview(image.url, image.prompt)}
                      >
                        <img src={image.url} alt={image.prompt ?? ''} className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]" />
                        <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                          #{generatedImages.length - index}
                        </span>
                      </button>
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
}: {
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <Select
      value={value}
      onValueChange={onChange}
    >
      <SelectTrigger className="h-9 w-full border-border bg-background px-3 text-xs shadow-none">
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
  onPreview,
  onRemove,
}: {
  url: string;
  label: string;
  onPreview: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="group relative aspect-square overflow-hidden rounded-md border border-border bg-muted">
      <button type="button" className="h-full w-full" onClick={onPreview}>
        <img src={url} alt="" className="h-full w-full object-cover" />
      </button>
      <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
        {label}
      </span>
      <button
        type="button"
        className="absolute right-1 top-1 hidden size-6 items-center justify-center rounded-full bg-background/85 text-muted-foreground shadow-sm hover:text-destructive group-hover:flex"
        onClick={onRemove}
      >
        <X className="size-3.5" />
      </button>
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
