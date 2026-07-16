'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Clock3,
  Coins,
  Crop,
  Diamond,
  Image as ImageIcon,
  LayoutTemplate,
  Loader2,
  Maximize2,
  Music,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Video,
  Volume2,
  WandSparkles,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { computeTaskEstimate, type ParamsSchema, type PricingSchema } from '@autix/domain/pricing';
import { type ModelConfigItem } from '@autix/shared-store';
import { MagneticButton } from '../../GrowthInteractions';
import {
  buildPublicVideoEstimateInput,
  getVideoReferenceUploadLimit,
  resolveVideoCapabilityFromModelConfig,
} from '../../generator-video-presenters';
import type { PublicVideoReference } from '../generator-studio-helpers';
import { VideoModelParamMenu, VideoOptionParamMenu, VideoSliderParamMenu } from './VideoParamMenus';
import { PublicVideoMediaDialog } from './VideoMediaDialog';
import { PublicVideoTemplateDialog } from './VideoTemplateDialog';
import {
  applyTemplateToStudioForm,
  type StudioTemplateSelection,
} from './template-apply.helpers';
import { useVideoWorkbenchTemplates } from '../../../video/workbench/useVideoWorkbenchTemplates';
import type { WorkbenchVideoTemplate } from '../../../video/workbench/constants';
import {
  buildPublicVideoGenerationPayload,
  type PublicVideoGenerationPayload,
} from './public-video-generation';

function limitPublicVideoReferences(refs: PublicVideoReference[], limit: number) {
  if (limit <= 0) return [];
  return refs.slice(-limit);
}

function mergePublicVideoReferences(
  current: PublicVideoReference[],
  additions: PublicVideoReference[],
  limit: number,
) {
  const next = [...current];
  for (const ref of additions) {
    const duplicateIndex = next.findIndex((item) => item.url === ref.url);
    if (duplicateIndex >= 0) next.splice(duplicateIndex, 1);
    next.push(ref);
  }
  return limitPublicVideoReferences(next, limit);
}

export function VideoSidebar({
  initialModel,
  videoModels,
  selectedModel,
  selectedModelId,
  selectedModelValue,
  modelsLoading,
  paramsSchema,
  pricingSchema,
  pricingContext,
  generating,
  onGenerate,
  onModelChange,
  textModels,
  textModelsLoading,
  selectedTextModelId,
  onTextModelChange,
  optimizing,
  onOptimizePrompt,
}: {
  initialModel?: string | null;
  videoModels: ModelConfigItem[];
  selectedModel: ModelConfigItem | null;
  selectedModelId: string | null;
  selectedModelValue?: string | null;
  modelsLoading: boolean;
  paramsSchema: ParamsSchema | undefined;
  pricingSchema: PricingSchema | undefined;
  pricingContext: { multiplier: number; discountFactor: number };
  generating: boolean;
  onGenerate: (payload: PublicVideoGenerationPayload) => Promise<void>;
  onModelChange: (modelId: string) => void;
  textModels: ModelConfigItem[];
  textModelsLoading: boolean;
  selectedTextModelId: string | null;
  onTextModelChange: (modelId: string) => void;
  optimizing: boolean;
  onOptimizePrompt: (prompt: string) => Promise<string | null>;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const tCommon = useTranslations('common');
  const tImagePrompt = useTranslations('imageStudio.prompt');
  const videoCapability = useMemo(
    () => resolveVideoCapabilityFromModelConfig(selectedModel, initialModel),
    [initialModel, selectedModel],
  );
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState(videoCapability.defaultDuration);
  const [resolution, setResolution] = useState(videoCapability.defaultResolution);
  const [ratio, setRatio] = useState<string>(videoCapability.defaultRatio);
  const [generateAudio, setGenerateAudio] = useState(videoCapability.audio);
  const [selectedVideoRefs, setSelectedVideoRefs] = useState<PublicVideoReference[]>([]);
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateSelection, setTemplateSelection] = useState<StudioTemplateSelection | null>(null);
  const [templateNotice, setTemplateNotice] = useState<
    | { kind: 'success' | 'warning'; message: string; href?: string; hrefLabel?: string }
    | null
  >(null);
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);
  const [estimateCost, setEstimateCost] = useState<number | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);
  const {
    templatesLoading,
    templateSearch,
    setTemplateSearch,
    templateCategory,
    setTemplateCategory,
    templateCategories,
    filteredTemplates,
  } = useVideoWorkbenchTemplates();
  const textModelOptions = useMemo(
    () => textModels.map((item) => ({ value: item.id, label: item.name })),
    [textModels],
  );
  const selectedTextModel = textModels.find((item) => item.id === selectedTextModelId) ?? null;
  const optimizeModelLabel = textModelsLoading
    ? t('modelLoading')
    : selectedTextModel?.name ?? t('optimizeModel');
  const model = selectedModelValue ?? initialModel ?? undefined;
  const modelLabel = selectedModel?.name ?? videoCapability.displayName;
  const uploadLimit = getVideoReferenceUploadLimit(selectedModel);
  const hasVideoRefs = selectedVideoRefs.length > 0;
  const durationOptions = videoCapability.durations;
  const ratioOptions = useMemo(
    () =>
      videoCapability.ratios.map((value) => ({
        value,
        label: value === 'adaptive' ? t('auto') : t(`videoRatios.${value}`),
      })),
    [t, videoCapability.ratios],
  );
  const resolutionOptions = useMemo(
    () => videoCapability.resolutions.map((value) => ({
      value,
      label: t(`videoResolutions.${value}`),
    })),
    [t, videoCapability.resolutions],
  );
  const ratioLabel = ratioOptions.find((option) => option.value === ratio)?.label ?? ratio;
  const durationLabel = `${duration}s`;

  useEffect(() => {
    setResolution((current) =>
      videoCapability.resolutions.includes(current)
        ? current
        : videoCapability.defaultResolution,
    );
    setDuration((current) =>
      videoCapability.durations.includes(current) ? current : videoCapability.defaultDuration,
    );
    setRatio((current) =>
      (videoCapability.ratios as string[]).includes(current)
        ? current
        : videoCapability.defaultRatio,
    );
    setGenerateAudio((current) => (videoCapability.audio ? current : false));
  }, [videoCapability]);

  useEffect(() => {
    setSelectedVideoRefs((current) => limitPublicVideoReferences(current, uploadLimit));
  }, [uploadLimit]);

  useEffect(() => {
    if (!promptDialogOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPromptDialogOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [promptDialogOpen]);

  useEffect(() => {
    if (!selectedModel || !pricingSchema || !paramsSchema) {
      setEstimateCost(null);
      return;
    }

    // 本地即时计价：与服务端 estimateCost 调**同一个** computeTaskEstimate（同函数 →
    // 同结果，保证展示 == 扣费）。不再走 /points/estimate，无网络往返、无 250ms 防抖延迟。
    // 报价参数 == 生成参数：buildPublicVideoEstimateInput 归一化 resolution、seconds、
    // referenceImages 等隐藏计价参数。video_generation 与 image 一样 taskFixedSchema 恒为
    // null（presets.ts: video_generation.fixedCostSchema = null）。
    const { params } = buildPublicVideoEstimateInput({
      model,
      modelConfig: selectedModel,
      duration,
      resolution,
      generateAudio,
      referenceImages: selectedVideoRefs.length,
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
    pricingSchema,
    paramsSchema,
    pricingContext,
    duration,
    generateAudio,
    model,
    resolution,
    selectedModel,
    selectedVideoRefs.length,
  ]);

  const addVideoRefs = (refs: PublicVideoReference[]) => {
    setSelectedVideoRefs((current) => mergePublicVideoReferences(current, refs, uploadLimit));
  };

  const removeVideoRef = (id: string) => {
    setSelectedVideoRefs((current) => current.filter((ref) => ref.id !== id));
  };

  const handleOptimize = async () => {
    if (optimizing) return;
    const current = prompt.trim();
    if (!current) {
      setOptimizeError(t('optimizeEmpty'));
      return;
    }
    setOptimizeError(null);
    try {
      const optimized = await onOptimizePrompt(current);
      if (optimized) setPrompt(optimized);
    } catch {
      setOptimizeError(t('optimizeFailed'));
    }
  };

  const handleApplyTemplate = (template: WorkbenchVideoTemplate) => {
    if (template.templateKind === 'workflow') {
      setTemplateNotice({
        kind: 'warning',
        message: t('templateWorkflowRedirect'),
        href: `/ai/video?templateId=${encodeURIComponent(template.id)}`,
        hrefLabel: t('templateGoToWorkbench'),
      });
      return;
    }
    const availableModelIds = videoModels.map((item) => item.id);
    const result = applyTemplateToStudioForm({
      template,
      capability: videoCapability,
      availableModelIds,
      currentModelId: selectedModelId,
    });
    setPrompt(result.prompt);
    setDuration(result.duration);
    setResolution(result.resolution);
    setRatio(result.ratio);
    setGenerateAudio(result.generateAudio);
    if (result.modelId && result.modelId !== selectedModelId) {
      onModelChange(result.modelId);
    }
    setTemplateSelection(result.selection);
    setTemplateDialogOpen(false);
    const hasClamp = result.clampedFields.length > 0;
    const hasUnresolved = result.unresolvedVariables.length > 0;
    let message: string;
    if (hasClamp && hasUnresolved) {
      message = t('templateAppliedWithClampAndVars', {
        title: template.title,
        fields: result.clampedFields.join(' / '),
        vars: result.unresolvedVariables.map((v) => `{{${v}}}`).join(' '),
      });
    } else if (hasClamp) {
      message = t('templateAppliedWithClamp', {
        title: template.title,
        fields: result.clampedFields.join(' / '),
      });
    } else if (hasUnresolved) {
      message = t('templateAppliedWithVars', {
        title: template.title,
        vars: result.unresolvedVariables.map((v) => `{{${v}}}`).join(' '),
      });
    } else {
      message = t('templateAppliedToast', { title: template.title });
    }
    setTemplateNotice({
      kind: hasUnresolved ? 'warning' : 'success',
      message,
    });
  };

  const handleClearTemplate = () => {
    setTemplateSelection(null);
    setTemplateNotice(null);
  };

  const handleGenerate = async () => {
    setGenerateError(null);
    try {
      await onGenerate(
        buildPublicVideoGenerationPayload({
          prompt,
          model,
          selectedModelId,
          modelName: selectedModel?.model,
          duration,
          resolution,
          ratio,
          generateAudio,
          materials: selectedVideoRefs,
          templateId: templateSelection?.templateId ?? null,
        }),
      );
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : t('generateFailed'));
    }
  };

  return (
    <aside className="growth-sidebar-shadow flex rounded-[16px] border border-border bg-card/92 lg:sticky lg:top-24 lg:h-[calc(100svh-8rem)] lg:flex-col">
      <div className="growth-dark-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
        <div className="mb-3 flex items-center gap-4 border-b border-border pb-2.5">
          <button
            type="button"
            className="relative min-h-8 px-0 text-sm font-bold text-foreground after:absolute after:inset-x-0 after:-bottom-[11px] after:h-0.5 after:rounded-full after:bg-foreground"
          >
            {t('createVideo')}
          </button>
          {[t('editVideo'), t('motionControl')].map((label) => (
            <span
              key={label}
              aria-disabled="true"
              title={t('comingSoon')}
              className="inline-flex min-h-8 cursor-not-allowed items-center text-sm font-semibold text-foreground/42"
            >
              {label}
            </span>
          ))}
        </div>

        <div className="mb-2.5 flex items-stretch gap-2">
          <button
            type="button"
            onClick={() => setTemplateDialogOpen(true)}
            className="group relative flex min-h-[54px] flex-1 items-center gap-2.5 overflow-hidden rounded-[12px] border border-border bg-card/85 px-3 text-left transition hover:border-input hover:bg-secondary"
          >
            {templateSelection?.coverImage ? (
              <span className="relative size-9 shrink-0 overflow-hidden rounded-[8px] border border-border bg-background">
                <img
                  src={templateSelection.coverImage}
                  alt={templateSelection.templateTitle}
                  className="h-full w-full object-cover"
                />
              </span>
            ) : (
              <span className="grid size-9 shrink-0 place-items-center rounded-[8px] bg-secondary text-foreground/60">
                <LayoutTemplate className="size-4" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-bold text-foreground/85">
                {templateSelection ? templateSelection.templateTitle : t('chooseTemplate')}
              </span>
              <span className="mt-0.5 block truncate text-[11px] font-medium text-foreground/45">
                {templateSelection ? t('changeTemplate') : t('templateEmptyLabel')}
              </span>
            </span>
          </button>
          {templateSelection ? (
            <button
              type="button"
              aria-label={t('clearTemplate')}
              onClick={handleClearTemplate}
              className="grid size-9 shrink-0 cursor-pointer place-items-center self-center rounded-full bg-secondary text-foreground/70 transition hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        {templateNotice ? (
          <div
            className={`mb-2.5 rounded-[10px] border px-3 py-2 text-xs font-semibold ${templateNotice.kind === 'warning'
              ? 'border-destructive/25 bg-destructive/8 text-destructive'
              : 'border-growth-accent/25 bg-growth-accent/8 text-growth-accent'
              }`}
          >
            <p>{templateNotice.message}</p>
            {templateNotice.href ? (
              <a
                href={templateNotice.href}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex text-[11px] font-black uppercase underline underline-offset-2"
              >
                {templateNotice.hrefLabel}
              </a>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setMediaDialogOpen(true)}
          className="growth-inset-top-highlight group relative grid min-h-[82px] w-full cursor-pointer place-items-center overflow-hidden rounded-[13px] border border-border bg-card p-3 text-center text-sm text-foreground/48 transition hover:border-input hover:bg-secondary hover:text-foreground"
        >
          <span className="growth-radial-top-overlay pointer-events-none absolute inset-0 opacity-80" />
          {hasVideoRefs ? (
            <span className="relative grid w-full grid-cols-4 gap-2">
              {selectedVideoRefs.slice(0, 4).map((ref, index) => {
                const overflow = selectedVideoRefs.length - 4;
                const isOverflowTile = index === 3 && overflow > 0;
                return (
                  <span
                    key={ref.id}
                    className="relative aspect-square overflow-hidden rounded-[10px] border border-border bg-background"
                  >
                    <img src={ref.url} alt={ref.name} className="h-full w-full object-cover" />
                    {isOverflowTile ? (
                      <span className="absolute inset-0 grid place-items-center bg-background/68 text-sm font-bold text-foreground backdrop-blur-[1px]">
                        +{overflow}
                      </span>
                    ) : (
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label="remove"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          removeVideoRef(ref.id);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            event.stopPropagation();
                            removeVideoRef(ref.id);
                          }
                        }}
                        className="absolute right-0.5 top-0.5 grid size-5 cursor-pointer place-items-center rounded-full bg-background/82 text-foreground/85 shadow-sm outline-none transition hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-growth-accent/55"
                      >
                        <X className="size-3" />
                      </span>
                    )}
                  </span>
                );
              })}
              {selectedVideoRefs.length < uploadLimit && selectedVideoRefs.length < 4 ? (
                <span className="grid aspect-square place-items-center rounded-[10px] border border-dashed border-border bg-secondary">
                  <Plus className="size-4" />
                </span>
              ) : null}
            </span>
          ) : (
            <>
              <span className="relative mb-2 inline-flex items-center justify-center -space-x-2">
                {[
                  { key: 'image', Icon: ImageIcon },
                  { key: 'video', Icon: Video },
                  { key: 'music', Icon: Music },
                ].map(({ key, Icon }, index) => (
                  <span
                    key={key}
                    className="grid size-7 place-items-center rounded-full border border-border bg-secondary text-foreground/44 transition group-hover:text-foreground/70"
                    style={{ zIndex: index + 1 }}
                  >
                    <Icon className="size-3" />
                  </span>
                ))}
              </span>
              <span className="relative text-sm font-semibold leading-none text-foreground/60">{t('uploadMedia')}</span>
              <span className="relative mt-1 block text-xs font-medium text-foreground/42">{t('uploadMediaHint')}</span>
            </>
          )}
          {hasVideoRefs ? (
            <span className="mt-2 block text-xs font-semibold text-growth-accent">
              {selectedVideoRefs.length}/{uploadLimit}
            </span>
          ) : null}
        </button>

        <label className="mt-2.5 block rounded-[13px] border border-border bg-secondary p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-foreground/42">{t('prompt')}</span>
            <button
              type="button"
              aria-label={t('prompt')}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setPromptDialogOpen(true);
              }}
              className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-full text-foreground/50 transition hover:bg-accent hover:text-foreground"
            >
              <Maximize2 className="size-3.5" />
            </button>
          </div>
          <textarea
            className="mt-1.5 min-h-[120px] w-full resize-none bg-transparent text-sm leading-6 text-foreground outline-none placeholder:text-foreground/36"
            placeholder={t('videoPromptPlaceholder')}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <div className="mt-2 flex items-center gap-2">
            {textModels.length > 0 ? (
              <div className="min-w-0 flex-1">
                <VideoOptionParamMenu
                  icon={<SlidersHorizontal className="size-4" />}
                  label={optimizeModelLabel}
                  title={t('optimizeModel')}
                  options={textModelOptions}
                  value={selectedTextModelId ?? ''}
                  onChange={onTextModelChange}
                  showChevron
                />
              </div>
            ) : (
              <span className="flex-1" />
            )}
            <button
              type="button"
              onClick={() => void handleOptimize()}
              disabled={optimizing}
              className="inline-flex shrink-0 min-h-8 cursor-pointer items-center gap-1.5 rounded-full bg-growth-accent/15 px-3 py-1 text-xs font-bold text-growth-accent transition hover:bg-growth-accent/25 disabled:cursor-wait disabled:opacity-70"
            >
              {optimizing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <WandSparkles className="size-3.5" />
              )}
              {optimizing ? t('optimizing') : t('optimize')}
            </button>
          </div>
          {optimizeError ? (
            <p className="mt-1.5 text-xs font-semibold text-destructive">{optimizeError}</p>
          ) : null}
        </label>

        <div className="mt-2.5 space-y-1.5">
          <VideoModelParamMenu
            icon={<SlidersHorizontal className="size-4" />}
            label={modelLabel}
            models={videoModels}
            selectedModelId={selectedModelId}
            loading={modelsLoading}
            onChange={onModelChange}
            fallbackLabel={videoCapability.displayName}
          />
          <div className="grid grid-cols-2 gap-2">
            <VideoSliderParamMenu
              icon={<Clock3 className="size-4" />}
              label={durationLabel}
              title={t('durationLabel')}
              options={durationOptions}
              value={duration}
              onChange={(value) => setDuration(value)}
            />
            <VideoOptionParamMenu
              icon={<Crop className="size-4" />}
              label={ratioLabel}
              title={t('aspectRatio')}
              options={ratioOptions}
              value={ratio}
              onChange={setRatio}
            />
            <VideoOptionParamMenu
              icon={<Diamond className="size-4" />}
              label={resolution}
              title={t('selectResolution')}
              options={resolutionOptions}
              value={resolution}
              onChange={(value) => {
                if (videoCapability.resolutions.includes(value as typeof resolution)) {
                  setResolution(value as typeof resolution);
                }
              }}
            />
            {videoCapability.audio ? (
              <button
                type="button"
                onClick={() => setGenerateAudio((prev) => !prev)}
                className={`flex min-h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-[11px] border border-border px-3 text-xs font-bold transition ${generateAudio ? 'bg-growth-accent/15 text-growth-accent' : 'bg-secondary text-foreground/45 line-through hover:bg-accent'}`}
              >
                <Volume2 className="size-4" />
                {t('audioOn')}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="border-t border-border bg-card/88 px-3 pb-3 pt-2.5 lg:shrink-0">
        <MagneticButton
          type="button"
          disabled={generating}
          onClick={() => void handleGenerate()}
          className="growth-generator-generate flex min-h-12 w-full flex-row flex-wrap items-center justify-center gap-x-3 gap-y-0.5 rounded-[13px] bg-growth-accent px-4 text-sm font-black text-background hover:bg-foreground disabled:cursor-wait disabled:opacity-75"
        >
          <span className="inline-flex items-center gap-2">
            {generating ? t('generating') : t('generate')}
            <Sparkles className="size-4 fill-background" />
          </span>
          {generating ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-background/70">
              <Loader2 className="size-3 animate-spin" />
              {t('stayHere')}
            </span>
          ) : estimateCost != null ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-background/66">
              <Coins className="size-3.5" />
              {tImagePrompt('costPoints', { points: estimateCost })}
            </span>
          ) : null}
        </MagneticButton>
        {generateError ? (
          <p className="mt-2 rounded-[10px] border border-destructive/25 bg-destructive/8 px-3 py-2 text-xs font-semibold text-destructive">
            {generateError}
          </p>
        ) : null}
      </div>
      <PublicVideoMediaDialog
        open={mediaDialogOpen}
        selectedRefs={selectedVideoRefs}
        limit={uploadLimit}
        onAddRefs={addVideoRefs}
        onRemoveRef={removeVideoRef}
        onClose={() => setMediaDialogOpen(false)}
      />
      <PublicVideoTemplateDialog
        open={templateDialogOpen}
        templates={filteredTemplates}
        categories={templateCategories}
        loading={templatesLoading}
        search={templateSearch}
        category={templateCategory}
        applyingId={null}
        onSearchChange={setTemplateSearch}
        onCategoryChange={setTemplateCategory}
        onApply={handleApplyTemplate}
        onClose={() => setTemplateDialogOpen(false)}
      />
      {promptDialogOpen
        ? createPortal(
          <div
            className="fixed inset-0 z-[90] grid place-items-center bg-background/80 p-4 backdrop-blur-md md:p-6"
            onClick={() => setPromptDialogOpen(false)}
          >
            <div
              className="growth-sheet-shadow flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-[18px] border border-border bg-card ring-1 ring-border/35"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex h-[54px] shrink-0 items-center justify-between gap-2 border-b border-border px-4">
                <span className="text-sm font-bold text-foreground">{t('prompt')}</span>
                <button
                  type="button"
                  aria-label={t('prompt')}
                  onClick={() => setPromptDialogOpen(false)}
                  className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full bg-secondary text-foreground/70 transition hover:bg-accent hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
              <textarea
                autoFocus
                className="growth-dark-scrollbar min-h-[42vh] w-full flex-1 resize-none bg-transparent p-4 text-sm leading-7 text-foreground outline-none placeholder:text-foreground/36"
                placeholder={t('videoPromptPlaceholder')}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              {optimizeError ? (
                <p className="px-4 pt-2 text-xs font-semibold text-destructive">{optimizeError}</p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2 border-t border-border p-3">
                {textModels.length > 0 ? (
                  <div className="min-w-0 flex-1">
                    <VideoOptionParamMenu
                      icon={<SlidersHorizontal className="size-4" />}
                      label={optimizeModelLabel}
                      title={t('optimizeModel')}
                      options={textModelOptions}
                      value={selectedTextModelId ?? ''}
                      onChange={onTextModelChange}
                      showChevron
                      contentClassName="z-[100]"
                    />
                  </div>
                ) : (
                  <span className="flex-1" />
                )}
                <button
                  type="button"
                  onClick={() => void handleOptimize()}
                  disabled={optimizing}
                  className="inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-growth-accent/15 px-3.5 py-1.5 text-xs font-bold text-growth-accent transition hover:bg-growth-accent/25 disabled:cursor-wait disabled:opacity-70"
                >
                  {optimizing ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <WandSparkles className="size-3.5" />
                  )}
                  {optimizing ? t('optimizing') : t('optimize')}
                </button>
                <button
                  type="button"
                  onClick={() => setPromptDialogOpen(false)}
                  className="inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-growth-accent px-4 py-1.5 text-xs font-black text-background transition hover:bg-foreground"
                >
                  {tCommon('confirm')}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
        : null}
    </aside>
  );
}
