'use client';

import { useEffect, useRef, useState } from 'react';
import type { ClipboardEvent } from 'react';
import {
  Coins,
  Globe2,
  ImagePlus,
  Loader2,
  Lock,
  // Pencil,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ParamsSchema, PricingSchema } from '@autix/domain/pricing';
import { publicGeneratorActions, type ModelConfigItem } from '@autix/shared-store';
import { MagneticButton, SpotlightPanel } from '../../GrowthInteractions';
import { SchemaForm, translateSchemaKey, useSchemaForm } from '../../../pricing';
import {
  getImageReferenceUploadLimit,
} from '../../generator-image-presenters';
import { readFilesAsDataUrls } from '../../../image/studio/constants';
import { OfferStrip } from '../parts';
import type { PublicUploadedReference } from '../generator-studio-helpers';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../ui/tooltip';
import { ImageModelParamMenu } from './ImageParamMenus';
import {
  buildPublicImageEstimateInput,
  buildPublicImageGenerationSettings,
  type PublicImageGenerationPayload,
} from './public-image-generation';

function limitPublicUploadedReferences(
  refs: PublicUploadedReference[],
  limit: number,
) {
  if (limit <= 0) return [];
  return refs.slice(-limit);
}

export function ImageComposer({
  communityMode,
  imageModels,
  selectedModel,
  selectedModelId,
  selectedModelValue,
  modelsLoading,
  paramsSchema,
  pricingSchema,
  pricingContext,
  appliedTemplate,
  generating,
  onGenerate,
  onModelChange,
}: {
  communityMode: boolean;
  imageModels: ModelConfigItem[];
  selectedModel: ModelConfigItem | null;
  selectedModelId: string | null;
  selectedModelValue?: string | null;
  modelsLoading: boolean;
  /**
   * 当前选中模型的计价 schema（pricingActions.getTaskModels('image_generation')）。
   * 缺失（尚未拉到 / 模型不在计价表里）→ 不渲染参数控件、不允许生成——
   * 不再 fallback 到静态能力表（spec §12：DEFAULT_IMAGE_KIND 那条「未识别模型
   * 拿到 gemini-3-pro-image 尺寸表，用户能选到该模型根本不支持的 4K」的洞由此消失）。
   */
  paramsSchema: ParamsSchema | undefined;
  pricingSchema: PricingSchema | undefined;
  pricingContext: { multiplier: number; discountFactor: number };
  appliedTemplate?: { id: string; title: string; prompt: string } | null;
  generating: boolean;
  onGenerate: (payload: PublicImageGenerationPayload) => Promise<void>;
  onModelChange: (modelId: string) => void;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const tImagePrompt = useTranslations('imageStudio.prompt');
  const tParams = useTranslations('pricing.params');
  // 画质档位显示名走 i18n(pricing.options.<value>)。
  const tOptions = useTranslations('pricing.options');
  const [prompt, setPrompt] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [uploadedRefs, setUploadedRefs] = useState<PublicUploadedReference[]>([]);
  const [uploading, setUploading] = useState(false);
  const [estimateCost, setEstimateCost] = useState<number | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);

  const schemaMissing = !paramsSchema || !pricingSchema;
  // schema 缺失时不喂 schema 给 useSchemaForm（返回 {}），而不是喂一个「假装存在」的
  // schema——form.params 因此天然是空对象，handleGenerate 会把一个没有 size 的
  // settings 发给服务端，由服务端的 required 校验拒绝，而不是前端伪造一个默认值。
  const form = useSchemaForm(schemaMissing ? undefined : paramsSchema);

  const modelLabel = selectedModel?.name ?? '';
  const uploadLimit = getImageReferenceUploadLimit(paramsSchema);
  const canUploadReference = uploadLimit > 0;
  const uploadSlotsRemaining = Math.max(0, uploadLimit - uploadedRefs.length);
  const hasUploadedRefs = uploadedRefs.length > 0;

  const syncPromptTextareaHeight = () => {
    const element = promptTextareaRef.current;
    if (!element) return;
    element.style.height = 'auto';
    const styles = window.getComputedStyle(element);
    const lineHeight = Number.parseFloat(styles.lineHeight) || 24;
    const maxHeight = lineHeight * 8;
    const nextHeight = Math.min(element.scrollHeight, maxHeight);
    element.style.height = `${nextHeight}px`;
    element.style.overflowY = element.scrollHeight > maxHeight ? 'auto' : 'hidden';
  };

  useEffect(() => {
    if (!appliedTemplate?.prompt) return;
    setPrompt(appliedTemplate.prompt);
  }, [appliedTemplate?.id, appliedTemplate?.prompt]);

  useEffect(() => {
    syncPromptTextareaHeight();
  }, [prompt, hasUploadedRefs]);

  useEffect(() => {
    const handleResize = () => syncPromptTextareaHeight();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setUploadedRefs((current) => limitPublicUploadedReferences(current, uploadLimit));
  }, [uploadLimit]);

  useEffect(() => {
    if (!selectedModelId || !selectedModel || schemaMissing) {
      setEstimateCost(null);
      setEstimateLoading(false);
      return;
    }

    let cancelled = false;
    setEstimateLoading(true);
    const timer = window.setTimeout(() => {
      publicGeneratorActions
        .estimateGeneration(
          buildPublicImageEstimateInput({
            // 报价参数 == 生成参数：同一个 form.params 引用，只在这里补上真实
            // 上传张数（referenceImages 是隐藏计价参数，表单里恒为 schema 默认值 0）。
            params: form.params,
            model: selectedModel,
            selectedModelId,
            referenceImages: uploadedRefs.length,
          }),
        )
        .then((estimate) => {
          if (!cancelled) setEstimateCost(estimate.estimatedCost);
        })
        .catch(() => {
          if (!cancelled) setEstimateCost(null);
        })
        .finally(() => {
          if (!cancelled) setEstimateLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [selectedModelId, selectedModel, schemaMissing, form.params, uploadedRefs.length]);

  const openUploadDialog = () => {
    if (!canUploadReference || uploadSlotsRemaining <= 0 || uploading) return;
    fileInputRef.current?.click();
  };

  const handleUploadFiles = async (files: FileList | File[] | null) => {
    if (!files || !canUploadReference || uploadSlotsRemaining <= 0) return;
    const imageFiles = Array.from(files)
      .filter((file) => file.type.startsWith('image/'))
      .slice(0, uploadSlotsRemaining);
    if (imageFiles.length === 0) return;

    setUploading(true);
    try {
      const urls = await readFilesAsDataUrls(imageFiles);
      const stamp = Date.now();
      setUploadedRefs((current) =>
        limitPublicUploadedReferences(
          [
            ...current,
            ...urls.map((url, index) => ({
              id: `upload-${stamp}-${index}`,
              url,
              name: imageFiles[index]?.name ?? t('uploadImage'),
            })),
          ],
          uploadLimit,
        ),
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    if (!canUploadReference || uploadSlotsRemaining <= 0) return;
    const items = event.clipboardData?.items;
    if (!items?.length) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item.kind !== 'file' || !item.type.startsWith('image/')) continue;
      const file = item.getAsFile();
      if (file) files.push(file);
    }
    if (files.length === 0) return;
    event.preventDefault();
    void handleUploadFiles(files);
  };

  const removeUploadedRef = (id: string) => {
    setUploadedRefs((current) => current.filter((ref) => ref.id !== id));
  };

  const handleGenerate = async () => {
    const model = selectedModelId ?? selectedModelValue ?? null;
    const trimmedPrompt = prompt.trim();
    if (!model) {
      setGenerateError(t('selectModelFirst'));
      return;
    }
    if (!trimmedPrompt) {
      setGenerateError(t('promptRequired'));
      return;
    }
    // 生成用的 settings —— 与上面报价用的是同一个 form.params（spec §11 第 2 期
    // 验收标准第 7 条：报价参数与生成参数必须是同一个对象）。
    const settings = buildPublicImageGenerationSettings(form.params);
    setGenerateError(null);
    try {
      await onGenerate({
        model,
        prompt: trimmedPrompt,
        referenceImages: uploadedRefs.map((ref) => ref.url),
        settings,
        visibility,
      });
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : t('generateFailed'));
    }
  };

  return (
    <div className="pointer-events-auto relative mx-auto w-full max-w-6xl px-4">
      <OfferStrip
        label={t('imageOffer')}
        premium={t('premiumPlans')}
        className="mx-auto mb-2 max-w-6xl"
      />
      <SpotlightPanel className="growth-panel-shadow mx-auto rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(32,34,37,0.88),rgba(24,26,29,0.92))] p-[22px] backdrop-blur-[32px]">
        <div className="grid items-stretch gap-3 md:grid-cols-[1fr_174px]">
          <div className="min-w-0">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => void handleUploadFiles(e.target.files)}
            />
            <div className={`rounded-md text-sm text-foreground/48 ${hasUploadedRefs ? 'space-y-4' : 'flex min-h-12 items-start gap-3'}`}>
              {hasUploadedRefs ? (
                <div className="flex flex-wrap items-center gap-3">
                  {uploadedRefs.map((ref) => (
                    <div
                      key={ref.id}
                      className="group relative size-20 overflow-hidden rounded-md border border-border bg-background/40"
                    >
                      <img
                        src={ref.url}
                        alt={ref.name}
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        aria-label={t('close')}
                        className="absolute right-1 top-1 grid size-6 cursor-pointer place-items-center rounded-md bg-background/65 text-foreground/70 opacity-0 transition hover:bg-background hover:text-foreground group-hover:opacity-100"
                        onClick={() => removeUploadedRef(ref.id)}
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                  {uploadSlotsRemaining > 0 ? (
                    <button
                      type="button"
                      title={t('uploadImage')}
                      aria-label={t('uploadImage')}
                      className="grid size-20 cursor-pointer place-items-center rounded-md border border-border bg-secondary text-foreground transition hover:border-growth-accent/45 hover:bg-secondary hover:text-growth-accent disabled:cursor-not-allowed disabled:opacity-45"
                      disabled={uploading}
                      onClick={openUploadDialog}
                    >
                      {uploading ? <Loader2 className="size-6 animate-spin" /> : <ImagePlus className="size-6" />}
                    </button>
                  ) : null}
                </div>
              ) : (
                <button
                  type="button"
                  title={t('uploadImage')}
                  aria-label={t('uploadImage')}
                  className={`grid size-9 shrink-0 place-items-center rounded-xl border border-border bg-background/22 text-foreground/78 transition hover:bg-secondary hover:text-foreground ${canUploadReference ? 'cursor-pointer' : 'cursor-not-allowed opacity-45'}`}
                  disabled={!canUploadReference || uploading}
                  onClick={openUploadDialog}
                >
                  {uploading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                </button>
              )}
              <textarea
                ref={promptTextareaRef}
                rows={1}
                className="min-h-6 max-h-48 min-w-0 flex-1 resize-none overflow-hidden bg-transparent text-base leading-6 text-foreground outline-none placeholder:text-foreground/44"
                placeholder={communityMode ? t('templatePromptPlaceholder') : t('promptPlaceholder')}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onPaste={handlePaste}
              />
            </div>
            <div className="mt-2.5 flex flex-wrap items-start gap-3">
              <div className="flex flex-wrap gap-1.5">
                <ImageModelParamMenu
                  label={modelLabel}
                  models={imageModels}
                  selectedModelId={selectedModelId}
                  onChange={onModelChange}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-pressed={visibility === 'public'}
                      onClick={() =>
                        setVisibility((current) => (current === 'private' ? 'public' : 'private'))
                      }
                      className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-xl border border-border bg-background/22 px-3 text-sm font-semibold text-foreground/78 transition hover:bg-secondary hover:text-foreground"
                    >
                      {visibility === 'private' ? (
                        <Lock className="size-4" />
                      ) : (
                        <Globe2 className="size-4 text-growth-accent" />
                      )}
                      {visibility === 'private' ? t('private') : t('public')}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[260px] text-left">
                    <p className="flex items-start gap-1.5">
                      <Lock className="mt-0.5 size-3.5 shrink-0" />
                      <span>{t('privateHint')}</span>
                    </p>
                    <p className="mt-1.5 flex items-start gap-1.5">
                      <Globe2 className="mt-0.5 size-3.5 shrink-0" />
                      <span>{t('publicHint')}</span>
                    </p>
                  </TooltipContent>
                </Tooltip>
                {/* 「绘制」只是跳转 /draw 的导航链接，无生成相关后端逻辑，暂隐藏（需要时取消注释即可）
                <Link
                  href="/draw"
                  className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border bg-background/22 px-3 text-sm font-semibold text-foreground/78 transition hover:bg-secondary hover:text-foreground"
                >
                  <Pencil className="size-4" />
                  {t('draw')}
                </Link>
                */}
              </div>
              {paramsSchema && pricingSchema ? (
                <div className="min-w-[240px] max-w-sm flex-1">
                  <SchemaForm
                    paramsSchema={paramsSchema}
                    pricingSchema={pricingSchema}
                    pricingContext={pricingContext}
                    form={form}
                    translateLabel={(labelKey, fallback) =>
                      translateSchemaKey(tParams, 'pricing.params.', labelKey, fallback)
                    }
                    translateOption={(optionLabelKey, fallback) =>
                      translateSchemaKey(tOptions, 'pricing.options.', optionLabelKey, fallback)
                    }
                  />
                </div>
              ) : null}
            </div>
          </div>

          <MagneticButton
            type="button"
            disabled={generating || schemaMissing}
            onClick={() => void handleGenerate()}
            className="growth-generator-generate inline-flex h-full max-h-[94px] flex-col items-center justify-center gap-0.5 self-end rounded-2xl bg-growth-accent px-5 text-base font-black text-background hover:bg-foreground disabled:cursor-wait disabled:opacity-75"
          >
            <span className="inline-flex items-center gap-2">
              {generating ? t('generating') : t('generate')}
              <Sparkles className="size-4 fill-background" />
            </span>
            {generating ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-background/70">
                <Loader2 className="size-3 animate-spin" />
                {t('stayHere')}
              </span>
            ) : estimateLoading ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-background/60">
                <Loader2 className="size-3 animate-spin" />
              </span>
            ) : estimateCost != null ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-background/66">
                <Coins className="size-3.5" />
                {tImagePrompt('costPoints', { points: estimateCost })}
              </span>
            ) : null}
          </MagneticButton>
        </div>
        {generateError ? (
          <p className="mt-3 rounded-md border border-destructive/25 bg-destructive/8 px-3 py-2 text-sm font-semibold text-destructive">
            {generateError}
          </p>
        ) : null}
      </SpotlightPanel>
    </div>
  );
}
