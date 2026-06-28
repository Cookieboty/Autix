'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import {
  Clock3,
  Coins,
  Crop,
  Diamond,
  Image as ImageIcon,
  Loader2,
  Music,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Video,
  Volume2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  videoWorkbenchActions,
  type ModelConfigItem,
} from '@autix/shared-store';
import Link from 'next/link';
import { MagneticLink } from '../../GrowthInteractions';
import { buildGeneratorWorkbenchHref } from '../../generator-workbench-href';
import {
  DEFAULT_PUBLIC_VIDEO_MODEL,
  buildPublicVideoEstimateInput,
  getVideoReferenceUploadLimit,
  resolveVideoCapabilityFromModelConfig,
} from '../../generator-video-presenters';
import {
  DEFAULT_VIDEO_PARAMS,
  RATIO_VALUES,
} from '../../../video/workbench/constants';
import { MediaThumb } from '../../MediaBlocks';
import type { PublicGrowthMediaItem } from '../../types';
import { createPublicImageDraftId, type PublicVideoReference } from '../generator-studio-helpers';
import { VideoModelParamMenu, VideoOptionParamMenu } from './VideoParamMenus';
import { getSessionStorage } from '@autix/platform';
import { PublicVideoMediaDialog } from './VideoMediaDialog';

const PUBLIC_VIDEO_DRAFT_STORAGE_PREFIX = 'autix:public-video-draft:';

function limitPublicVideoReferences(refs: PublicVideoReference[], limit: number) {
  if (limit <= 0) return [];
  return refs.slice(-limit);
}

function writePublicVideoDraftMaterials(refs: PublicVideoReference[]) {
  if (typeof window === 'undefined' || refs.length === 0) return null;
  const draftId = createPublicImageDraftId();
  try {
    getSessionStorage().setItem(
      `${PUBLIC_VIDEO_DRAFT_STORAGE_PREFIX}${draftId}`,
      JSON.stringify({
        materials: refs.map((ref) => ({
          url: ref.url,
          name: ref.name || 'Reference image',
          sourceType: ref.sourceType ?? 'upload',
          sourceId: ref.sourceId,
        })),
      }),
    );
    return draftId;
  } catch {
    return null;
  }
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
  items,
  initialModel,
  videoModels,
  selectedModel,
  selectedModelId,
  selectedModelValue,
  modelsLoading,
  onModelChange,
}: {
  items: PublicGrowthMediaItem[];
  initialModel?: string | null;
  videoModels: ModelConfigItem[];
  selectedModel: ModelConfigItem | null;
  selectedModelId: string | null;
  selectedModelValue?: string | null;
  modelsLoading: boolean;
  onModelChange: (modelId: string) => void;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const tImagePrompt = useTranslations('imageStudio.prompt');
  const tVideoParams = useTranslations('videoWorkbench.parameterPanel');
  const tVideoRatios = useTranslations('videoWorkbench.ratios');
  const tVideoResolutions = useTranslations('videoWorkbench.resolutions');
  const preview = items[0];
  const videoCapability = useMemo(
    () => resolveVideoCapabilityFromModelConfig(selectedModel, initialModel),
    [initialModel, selectedModel],
  );
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState(DEFAULT_VIDEO_PARAMS.duration);
  const [resolution, setResolution] = useState(videoCapability.defaultResolution);
  const [ratio, setRatio] = useState<string>('adaptive');
  const [generateAudio, setGenerateAudio] = useState(DEFAULT_VIDEO_PARAMS.generateAudio);
  const [selectedVideoRefs, setSelectedVideoRefs] = useState<PublicVideoReference[]>([]);
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
  const [estimateCost, setEstimateCost] = useState<number | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const draftStorageKeyRef = useRef<string | null>(null);
  const model = selectedModelValue ?? initialModel ?? DEFAULT_PUBLIC_VIDEO_MODEL;
  const modelLabel = selectedModel?.name ?? videoCapability.displayName;
  const uploadLimit = getVideoReferenceUploadLimit(selectedModel);
  const hasVideoRefs = selectedVideoRefs.length > 0;
  const durationOptions = useMemo(() => [4, 5, 6, 7, 8, 9, 10, 11, 12, 15], []);
  const ratioOptions = useMemo(
    () => [
      { value: 'adaptive', label: t('auto') },
      ...RATIO_VALUES.filter((value) => value !== 'adaptive').map((value) => ({
        value,
        label: tVideoRatios(value),
      })),
    ],
    [t, tVideoRatios],
  );
  const resolutionOptions = useMemo(
    () => videoCapability.resolutions.map((value) => ({
      value,
      label: tVideoResolutions(value),
    })),
    [tVideoResolutions, videoCapability.resolutions],
  );
  const ratioLabel = ratioOptions.find((option) => option.value === ratio)?.label ?? ratio;
  const durationLabel = `${duration}s`;
  const buildVideoHref = (nextDraftId: string | null = draftId) =>
    buildGeneratorWorkbenchHref({
      kind: 'video',
      model,
      prompt,
      duration,
      resolution,
      ratio,
      generateAudio,
      draftId: nextDraftId ?? undefined,
    });
  const sidebarHref = buildVideoHref();

  useEffect(() => {
    setResolution((current) =>
      videoCapability.resolutions.includes(current)
        ? current
        : videoCapability.defaultResolution,
    );
  }, [videoCapability]);

  useEffect(() => {
    setSelectedVideoRefs((current) => limitPublicVideoReferences(current, uploadLimit));
  }, [uploadLimit]);

  useEffect(() => {
    if (selectedVideoRefs.length === 0) {
      if (draftStorageKeyRef.current) {
        getSessionStorage().removeItem(draftStorageKeyRef.current);
        draftStorageKeyRef.current = null;
      }
      setDraftId(null);
      return;
    }
    if (draftStorageKeyRef.current) {
      getSessionStorage().removeItem(draftStorageKeyRef.current);
      draftStorageKeyRef.current = null;
    }
    const nextDraftId = writePublicVideoDraftMaterials(selectedVideoRefs);
    draftStorageKeyRef.current = nextDraftId
      ? `${PUBLIC_VIDEO_DRAFT_STORAGE_PREFIX}${nextDraftId}`
      : null;
    setDraftId(nextDraftId);
  }, [selectedVideoRefs]);

  useEffect(() => {
    let cancelled = false;
    setEstimateLoading(true);
    const timer = window.setTimeout(() => {
      videoWorkbenchActions
        .estimateGeneration(
          buildPublicVideoEstimateInput({
            model,
            modelConfig: selectedModel,
            duration,
            resolution,
            generateAudio,
            referenceImages: selectedVideoRefs.length,
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
  }, [duration, generateAudio, model, resolution, selectedModel, selectedVideoRefs.length]);

  const addVideoRefs = (refs: PublicVideoReference[]) => {
    setSelectedVideoRefs((current) => mergePublicVideoReferences(current, refs, uploadLimit));
  };

  const removeVideoRef = (id: string) => {
    setSelectedVideoRefs((current) => current.filter((ref) => ref.id !== id));
  };

  const handleVideoWorkbenchClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!hasVideoRefs || draftId) return;
    const nextDraftId = writePublicVideoDraftMaterials(selectedVideoRefs);
    if (!nextDraftId) return;
    draftStorageKeyRef.current = `${PUBLIC_VIDEO_DRAFT_STORAGE_PREFIX}${nextDraftId}`;
    setDraftId(nextDraftId);
    event.currentTarget.href = buildVideoHref(nextDraftId);
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

        {preview ? (
          <Link href={sidebarHref} className="group relative block aspect-[16/5.8] cursor-pointer overflow-hidden rounded-[13px] border border-border bg-background">
            <MediaThumb item={preview} eager autoPlay className="opacity-70 transition duration-500 group-hover:scale-[1.04]" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/80" />
            <div className="absolute inset-x-3 bottom-3">
              <div className="text-lg font-black uppercase leading-none text-growth-accent">{t('generalPreset')}</div>
              <div className="mt-1 truncate text-[11px] font-semibold text-foreground/58">{modelLabel}</div>
            </div>
            <span className="absolute right-2 top-2 rounded-[8px] bg-background/50 px-2 py-1 text-[11px] font-bold text-foreground/84 backdrop-blur-sm">
              {t('change')}
            </span>
          </Link>
        ) : null}

        <button
          type="button"
          onClick={() => setMediaDialogOpen(true)}
          className="growth-inset-top-highlight group relative mt-2.5 grid min-h-[82px] w-full cursor-pointer place-items-center overflow-hidden rounded-[13px] border border-border bg-card p-3 text-center text-sm text-foreground/48 transition hover:border-input hover:bg-secondary hover:text-foreground"
        >
          <span className="growth-radial-top-overlay pointer-events-none absolute inset-0 opacity-80" />
          {hasVideoRefs ? (
            <span className="relative grid w-full grid-cols-4 gap-2">
              {selectedVideoRefs.slice(0, 4).map((ref) => (
                <span
                  key={ref.id}
                  className="relative aspect-square overflow-hidden rounded-[10px] border border-border bg-background"
                >
                  <img src={ref.url} alt={ref.name} className="h-full w-full object-cover" />
                </span>
              ))}
              {selectedVideoRefs.length < uploadLimit ? (
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
          <span className="text-xs font-bold text-foreground/42">{t('prompt')}</span>
          <textarea
            className="mt-1.5 min-h-[58px] w-full resize-none bg-transparent text-sm leading-6 text-foreground outline-none placeholder:text-foreground/36"
            placeholder={t('videoPromptPlaceholder')}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMediaDialogOpen(true)}
              className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full bg-background/38 px-2.5 py-1 text-xs font-bold text-foreground/72 hover:bg-background/55"
            >
              @ {t('elements')}
            </button>
            <button
              type="button"
              onClick={() => setGenerateAudio((prev) => !prev)}
              className={`inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold transition ${generateAudio ? 'bg-growth-accent/15 text-growth-accent' : 'bg-background/38 text-foreground/38 line-through'}`}
            >
              <Volume2 className="size-3.5" />
              {t('audioOn')}
            </button>
          </div>
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
          <div className="grid grid-cols-3 gap-2">
            <VideoOptionParamMenu
              icon={<Clock3 className="size-4" />}
              label={durationLabel}
              title={tVideoParams('durationLabel')}
              options={durationOptions.map((value) => ({ value: String(value), label: `${value}s` }))}
              value={String(duration)}
              onChange={(value) => setDuration(Number(value))}
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
          </div>
        </div>
      </div>

      <div className="border-t border-border bg-card/88 px-3 pb-3 pt-2.5 lg:shrink-0">
        <MagneticLink
          href={sidebarHref}
          onClick={(event) => handleVideoWorkbenchClick(event)}
          className="growth-generator-generate flex min-h-12 w-full flex-col items-center justify-center gap-0.5 rounded-[13px] bg-growth-accent px-4 text-sm font-black text-background hover:bg-foreground"
        >
          <span className="inline-flex items-center gap-2">
            {t('generate')}
            <Sparkles className="size-4 fill-background" />
          </span>
          {estimateLoading ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-background/60">
              <Loader2 className="size-3 animate-spin" />
            </span>
          ) : estimateCost != null ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-background/66">
              <Coins className="size-3.5" />
              {tImagePrompt('costPoints', { points: estimateCost })}
            </span>
          ) : null}
        </MagneticLink>
      </div>
      <PublicVideoMediaDialog
        open={mediaDialogOpen}
        selectedRefs={selectedVideoRefs}
        limit={uploadLimit}
        onAddRefs={addVideoRefs}
        onRemoveRef={removeVideoRef}
        onClose={() => setMediaDialogOpen(false)}
      />
    </aside>
  );
}
