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
import { computeTaskEstimate, type ParamsSchema, type PricingSchema } from '@autix/domain/pricing';
import { authActions, useAuthStore, type ModelConfigItem } from '@autix/shared-store';
import { MagneticButton, SpotlightPanel } from '../../GrowthInteractions';
import { translateSchemaKey, useSchemaForm } from '../../../pricing';
import {
  getImageReferenceUploadLimit,
} from '../../generator-image-presenters';
import { readFilesAsDataUrls } from '../media-inputs';
import { OfferStrip } from '../parts';
import type { PublicUploadedReference } from '../generator-studio-helpers';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../ui/tooltip';
import { ImageModelParamMenu } from './ImageParamMenus';
import { ImageSchemaParamMenus } from './ImageSchemaParamMenus';
import {
  buildPublicImageEstimateInput,
  buildPublicImageGenerationSettings,
  type PublicImageGenerationPayload,
} from './public-image-generation';
import { visibilityFromAutoPublish } from './visibility-default';

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
  appliedReference,
  appliedRecreate,
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
  /**
   * 历史详情弹窗点 Reference 塞回来的参考图。与 appliedTemplate 同一套路：父级每次
   * 换一个新的 id，这里据此追加到已上传参考图列表（超出模型上限时由
   * limitPublicUploadedReferences 裁掉最早的）。
   */
  appliedReference?: PublicUploadedReference | null;
  /**
   * Recreate 指令：把某次历史生成的 prompt + 参考图带回输入框（模型由父级切换）。
   * **不回填参数、不自动提交** —— 参数用户自己选，生成用户自己点。
   */
  appliedRecreate?: {
    id: string;
    prompt: string;
    referenceImages: string[];
  } | null;
  onGenerate: (payload: PublicImageGenerationPayload) => Promise<void>;
  onModelChange: (modelId: string) => void;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const tImagePrompt = useTranslations('imageStudio.prompt');
  const tParams = useTranslations('pricing.params');
  // 画质档位显示名走 i18n(pricing.options.<value>)。
  const tOptions = useTranslations('pricing.options');
  const [prompt, setPrompt] = useState('');
  const autoPublish = useAuthStore((s) => Boolean(s.user?.autoPublish));
  const authHydrated = useAuthStore((s) => s.hydrated);
  const [visibility, setVisibility] = useState<'private' | 'public'>(() =>
    visibilityFromAutoPublish(autoPublish),
  );
  // 用户本次是否手动切过；切过后本会话内不再被设置默认值覆盖，且绝不回写设置。
  const visibilityTouchedRef = useRef(false);

  // 进入页面拉一次 DB 最新 autoPublish(hydrate 只读本地，不打 /auth/profile)。非阻塞。
  useEffect(() => {
    const s = useAuthStore.getState();
    if (s.isAuthenticated && s.hydrated) {
      authActions.refreshProfile().catch(() => {});
    }
  }, [authHydrated]);

  // profile 异步落值后，只要用户未手动切过，默认可见性就跟随 autoPublish。
  useEffect(() => {
    if (!visibilityTouchedRef.current) {
      setVisibility(visibilityFromAutoPublish(autoPublish));
    }
  }, [autoPublish]);
  const [uploadedRefs, setUploadedRefs] = useState<PublicUploadedReference[]>([]);
  const [uploading, setUploading] = useState(false);
  const [estimateCost, setEstimateCost] = useState<number | null>(null);
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
    if (!appliedReference) return;
    setUploadedRefs((current) =>
      current.some((ref) => ref.url === appliedReference.url)
        ? current
        : limitPublicUploadedReferences([...current, appliedReference], uploadLimit),
    );
    // uploadLimit 不进依赖：它变化时下面那个 effect 已经会重新裁剪，这里只关心「又塞了一张」
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedReference?.id]);

  // Recreate：prompt 与参考图整体replace（不是追加——这是「重来一次」，不是「再加一张」）
  useEffect(() => {
    if (!appliedRecreate) return;
    setPrompt(appliedRecreate.prompt);
    setUploadedRefs(
      limitPublicUploadedReferences(
        appliedRecreate.referenceImages.map((url, index) => ({
          id: `${appliedRecreate.id}-ref-${index}`,
          url,
          name: `reference-${index + 1}.png`,
        })),
        uploadLimit,
      ),
    );
    // uploadLimit 不进依赖：模型切换后由下面的裁剪 effect 兜底
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedRecreate?.id]);

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
    if (!selectedModelId || !selectedModel || schemaMissing || !pricingSchema || !paramsSchema) {
      setEstimateCost(null);
      return;
    }

    // 本地即时计价：与服务端 estimateCost 调**同一个** computeTaskEstimate（同函数 →
    // 同结果，保证展示 == 扣费）。不再走 /points/estimate，无网络往返、无防抖延迟。
    // 报价参数 == 生成参数：同一个 form.params，只补上真实上传张数（referenceImages
    // 是隐藏计价参数，表单里恒为 schema 默认值 0）。图片任务 taskFixedSchema 恒为 null
    // （presets.ts: image_generation.fixedCostSchema = null）。
    const { params } = buildPublicImageEstimateInput({
      params: form.params,
      model: selectedModel,
      selectedModelId,
      referenceImages: uploadedRefs.length,
    });
    const result = computeTaskEstimate({
      pricingSchema,
      paramsSchema,
      multiplier: pricingContext.multiplier,
      discountFactor: pricingContext.discountFactor,
      taskFixedSchema: null,
      params,
    });
    setEstimateCost(result.violations.length > 0 ? null : result.total);
  }, [
    selectedModelId,
    selectedModel,
    schemaMissing,
    pricingSchema,
    paramsSchema,
    pricingContext,
    form.params,
    uploadedRefs.length,
  ]);

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
    await onGenerate({
      model,
      prompt: trimmedPrompt,
      referenceImages: uploadedRefs.map((ref) => ref.url),
      settings,
      visibility,
    });
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
                <div className="flex flex-wrap items-center gap-2.5">
                  {uploadedRefs.map((ref) => (
                    <div
                      key={ref.id}
                      className="group relative size-14 overflow-hidden rounded-xl border border-border bg-background/40"
                    >
                      <img
                        src={ref.url}
                        alt={ref.name}
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        aria-label={t('close')}
                        className="absolute right-0.5 top-0.5 grid size-5 cursor-pointer place-items-center rounded-full bg-background/65 text-foreground/70 opacity-0 transition hover:bg-background hover:text-foreground group-hover:opacity-100"
                        onClick={() => removeUploadedRef(ref.id)}
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                  {uploadSlotsRemaining > 0 ? (
                    <button
                      type="button"
                      title={t('uploadImage')}
                      aria-label={t('uploadImage')}
                      className="grid size-14 cursor-pointer place-items-center rounded-xl border border-border bg-background/22 text-foreground/78 transition hover:border-growth-accent/45 hover:bg-secondary hover:text-growth-accent disabled:cursor-not-allowed disabled:opacity-45"
                      disabled={uploading}
                      onClick={openUploadDialog}
                    >
                      {uploading ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
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
                {/* 「绘制」只是跳转 /draw 的导航链接，无生成相关后端逻辑，暂隐藏（需要时取消注释即可）
                <Link
                  href="/draw"
                  className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border bg-background/22 px-3 text-sm font-semibold text-foreground/78 transition hover:bg-secondary hover:text-foreground"
                >
                  <Pencil className="size-4" />
                  {t('draw')}
                </Link>
                */}
                {paramsSchema ? (
                  <ImageSchemaParamMenus
                    paramsSchema={paramsSchema}
                    form={form}
                    translateLabel={(labelKey, fallback) =>
                      translateSchemaKey(tParams, 'pricing.params.', labelKey, fallback)
                    }
                    translateOption={(optionLabelKey, fallback) =>
                      translateSchemaKey(tOptions, 'pricing.options.', optionLabelKey, fallback)
                    }
                    aspectTitle={t('aspectRatio')}
                    resolutionTitle={t('selectResolution')}
                  />
                ) : null}
                {/* 可见性：排在所有参数之后，只给图标（语义由 aria-label + tooltip 承担） */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-pressed={visibility === 'public'}
                      aria-label={visibility === 'private' ? t('private') : t('public')}
                      disabled={!authHydrated}
                      onClick={() => {
                        visibilityTouchedRef.current = true;
                        setVisibility((current) => (current === 'private' ? 'public' : 'private'));
                      }}
                      className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl border border-border bg-background/22 text-foreground/78 transition hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {visibility === 'private' ? (
                        <Lock className="size-4" />
                      ) : (
                        <Globe2 className="size-4 text-growth-accent" />
                      )}
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
              </div>
            </div>
          </div>

          <MagneticButton
            type="button"
            disabled={schemaMissing}
            onClick={() => void handleGenerate()}
            className="growth-generator-generate inline-flex h-full max-h-[94px] flex-col items-center justify-center gap-0.5 self-end rounded-2xl bg-growth-accent px-5 text-base font-black text-background hover:bg-foreground disabled:cursor-wait disabled:opacity-75"
          >
            <span className="inline-flex items-center gap-2">
              {t('generate')}
              <Sparkles className="size-4 fill-background" />
            </span>
            {estimateCost != null ? (
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
