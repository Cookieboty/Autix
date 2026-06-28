'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ClipboardEvent, MouseEvent } from 'react';
import {
  Coins,
  Crop,
  Diamond,
  ImagePlus,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  buildImageSizeResolutionGroups,
  resolveImageSizeSelection,
  selectImageSizeResolution,
  type ImageModelCapability,
} from '@autix/domain/image';
import {
  imageWorkbenchActions,
  type ModelConfigItem,
} from '@autix/shared-store';
import { ComingSoonControl } from '../../ComingSoonControl';
import { MagneticLink, SpotlightPanel } from '../../GrowthInteractions';
import {
  getImageCountControl,
  getImageReferenceUploadLimit,
} from '../../generator-image-presenters';
import { buildGeneratorWorkbenchHref } from '../../generator-workbench-href';
import { buildImageWorkbenchEstimateInput } from '../../../image/workbench/pricing';
import { readFilesAsDataUrls } from '../../../image/studio/constants';
import { OfferStrip } from '../parts';
import { createPublicImageDraftId, type PublicUploadedReference } from '../generator-studio-helpers';
import { getSessionStorage } from '@autix/platform';
import { ImageModelParamMenu, ImageOptionParamMenu } from './ImageParamMenus';

const PUBLIC_IMAGE_DRAFT_STORAGE_PREFIX = 'autix:public-image-draft:';

function getUniqueImageAspectOptions(groups: ReturnType<typeof buildImageSizeResolutionGroups>) {
  const seen = new Map<string, { label: string; value: string; aspectValue: string }>();
  for (const group of groups) {
    for (const option of group.options) {
      if (!seen.has(option.aspectValue)) {
        seen.set(option.aspectValue, {
          label: option.label,
          value: option.value,
          aspectValue: option.aspectValue,
        });
      }
    }
  }
  return Array.from(seen.values());
}

function selectImageSizeAspect(
  currentSizeValue: string,
  nextAspectValue: string,
  groups: ReturnType<typeof buildImageSizeResolutionGroups>,
) {
  const current = resolveImageSizeSelection(currentSizeValue, groups);
  const currentGroup = current.group;
  const sameResolution = currentGroup?.options.find(
    (option) => option.aspectValue === nextAspectValue,
  );
  if (sameResolution) return sameResolution.value;

  for (const group of groups) {
    const candidate = group.options.find((option) => option.aspectValue === nextAspectValue);
    if (candidate) return candidate.value;
  }

  return current.option?.value ?? currentSizeValue;
}

function limitPublicUploadedReferences(
  refs: PublicUploadedReference[],
  limit: number,
) {
  if (limit <= 0) return [];
  return refs.slice(-limit);
}

function writePublicImageDraftUploads(refs: PublicUploadedReference[]) {
  if (typeof window === 'undefined' || refs.length === 0) return null;
  const draftId = createPublicImageDraftId();
  try {
    getSessionStorage().setItem(
      `${PUBLIC_IMAGE_DRAFT_STORAGE_PREFIX}${draftId}`,
      JSON.stringify({
        uploadedRefs: refs.map((ref, index) => ({
          url: ref.url,
          label: ref.name || 'Upload',
          annotationKey: `public-upload:${draftId}:${index}`,
        })),
      }),
    );
    return draftId;
  } catch {
    return null;
  }
}

export function ImageComposer({
  communityMode,
  imageCapability,
  imageModels,
  selectedModel,
  selectedModelId,
  selectedModelValue,
  modelsLoading,
  appliedTemplate,
  onModelChange,
}: {
  communityMode: boolean;
  imageCapability: ImageModelCapability;
  imageModels: ModelConfigItem[];
  selectedModel: ModelConfigItem | null;
  selectedModelId: string | null;
  selectedModelValue?: string | null;
  modelsLoading: boolean;
  appliedTemplate?: { id: string; title: string; prompt: string } | null;
  onModelChange: (modelId: string) => void;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const tImagePrompt = useTranslations('imageStudio.prompt');
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState(imageCapability.defaults.size);
  const [quality, setQuality] = useState(imageCapability.defaults.quality);
  const [count, setCount] = useState(imageCapability.defaults.count);
  const [uploadedRefs, setUploadedRefs] = useState<PublicUploadedReference[]>([]);
  const [uploading, setUploading] = useState(false);
  const [estimateCost, setEstimateCost] = useState<number | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const draftStorageKeyRef = useRef<string | null>(null);
  const sizeGroups = useMemo(() => buildImageSizeResolutionGroups(imageCapability), [imageCapability]);
  const selectedSize = resolveImageSizeSelection(size, sizeGroups);
  const selectedGroup = selectedSize.group;
  const aspectOptions = useMemo(() => getUniqueImageAspectOptions(sizeGroups), [sizeGroups]);
  const modelLabel = selectedModel?.name ?? imageCapability.displayName;
  const countControl = getImageCountControl(imageCapability);
  const uploadLimit = getImageReferenceUploadLimit(imageCapability);
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
    setSize((current) =>
      imageCapability.sizes.some((option) => option.value === current)
        ? current
        : imageCapability.defaults.size,
    );
    setQuality((current) =>
      !imageCapability.qualities.length ||
        imageCapability.qualities.some((option) => option.value === current)
        ? current
        : imageCapability.defaults.quality,
    );
    setCount((current) =>
      Math.min(Math.max(1, current), imageCapability.maxCount || 1),
    );
    setUploadedRefs((current) => limitPublicUploadedReferences(current, getImageReferenceUploadLimit(imageCapability)));
  }, [imageCapability]);

  useEffect(() => {
    if (uploadedRefs.length === 0) {
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
    const nextDraftId = writePublicImageDraftUploads(uploadedRefs);
    draftStorageKeyRef.current = nextDraftId
      ? `${PUBLIC_IMAGE_DRAFT_STORAGE_PREFIX}${nextDraftId}`
      : null;
    setDraftId(nextDraftId);
  }, [uploadedRefs]);

  useEffect(() => {
    if (!selectedModelId || !selectedModel) {
      setEstimateCost(null);
      setEstimateLoading(false);
      return;
    }

    let cancelled = false;
    setEstimateLoading(true);
    const timer = window.setTimeout(() => {
      imageWorkbenchActions
        .estimateGeneration(
          buildImageWorkbenchEstimateInput({
            settings: {
              size,
              quality,
              count,
              guidanceScale: 7,
              steps: 30,
              seed: '',
              promptTuning: 'auto',
              stylePreset: 'general',
              negativePrompt: '',
            },
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
  }, [selectedModelId, selectedModel, size, quality, count, uploadedRefs.length]);

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

  const buildComposerHref = (nextDraftId: string | null = draftId) =>
    buildGeneratorWorkbenchHref({
      kind: 'image',
      model: selectedModelValue ?? undefined,
      prompt,
      size,
      quality: quality || undefined,
      count,
      draftId: nextDraftId ?? undefined,
    });
  const composerHref = buildComposerHref();
  const handleComposerClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!hasUploadedRefs || draftId) return;
    const nextDraftId = writePublicImageDraftUploads(uploadedRefs);
    if (!nextDraftId) return;
    draftStorageKeyRef.current = `${PUBLIC_IMAGE_DRAFT_STORAGE_PREFIX}${nextDraftId}`;
    setDraftId(nextDraftId);
    event.currentTarget.href = buildComposerHref(nextDraftId);
  };

  return (
    <div className="pointer-events-auto relative mx-auto w-full max-w-6xl px-4">
      <OfferStrip
        label={t('imageOffer')}
        premium={t('premiumPlans')}
        className="mx-auto max-w-6xl"
      />
      <SpotlightPanel className="growth-panel-shadow mx-auto rounded-md border border-border bg-card/95 p-4 backdrop-blur-xl md:p-5">
        <div className="grid gap-4 md:grid-cols-[1fr_174px]">
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
                  className={`grid size-9 shrink-0 place-items-center rounded-md border border-growth-accent/35 bg-growth-accent/5 text-growth-accent transition hover:bg-growth-accent/12 ${canUploadReference ? 'cursor-pointer' : 'cursor-not-allowed opacity-45'}`}
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
            <div className="mt-4 flex flex-wrap gap-2">
              <ImageModelParamMenu
                icon={<Sparkles className="size-4" />}
                label={modelLabel}
                models={imageModels}
                selectedModelId={selectedModelId}
                loading={modelsLoading}
                onChange={onModelChange}
                fallbackLabel={imageCapability.displayName}
              />
              <ImageOptionParamMenu
                icon={<Crop className="size-4" />}
                label={selectedSize.option?.label ?? selectedSize.option?.aspectValue ?? t('auto')}
                title={t('aspectRatio')}
                options={aspectOptions.map((option) => ({
                  label: option.label,
                  value: option.aspectValue,
                }))}
                value={selectedSize.option?.aspectValue ?? size}
                onChange={(nextAspect) =>
                  setSize((current) => selectImageSizeAspect(current, nextAspect, sizeGroups))
                }
              />
              {sizeGroups.length > 1 ? (
                <ImageOptionParamMenu
                  icon={<Diamond className="size-4" />}
                  label={selectedGroup?.label ?? t('auto')}
                  title={t('selectResolution')}
                  options={sizeGroups.map((group) => ({
                    label: group.label,
                    value: group.value,
                  }))}
                  value={selectedGroup?.value ?? ''}
                  onChange={(nextResolution) =>
                    setSize((current) =>
                      selectImageSizeResolution(current, nextResolution, sizeGroups),
                    )
                  }
                />
              ) : null}
              {imageCapability.qualities.length > 0 ? (
                <ImageOptionParamMenu
                  icon={<Diamond className="size-4" />}
                  label={
                    imageCapability.qualities.find((option) => option.value === quality)?.label ??
                    quality
                  }
                  title={t('selectQuality')}
                  options={imageCapability.qualities}
                  value={quality}
                  onChange={setQuality}
                />
              ) : null}
              {countControl.visible ? (
                <div className="inline-flex min-h-10 items-center rounded-md border border-border bg-background/22 text-sm font-semibold text-foreground/78">
                  <button
                    type="button"
                    aria-label={t('decreaseCount')}
                    className="grid size-10 place-items-center rounded-l-md text-foreground/45 hover:bg-secondary hover:text-foreground"
                    onClick={() => setCount((current) => Math.max(1, current - 1))}
                  >
                    -
                  </button>
                  <span className="min-w-14 px-2 text-center">{count}/{imageCapability.maxCount}</span>
                  <button
                    type="button"
                    aria-label={t('increaseCount')}
                    className="grid size-10 place-items-center rounded-r-md text-foreground/45 hover:bg-secondary hover:text-foreground"
                    onClick={() => setCount((current) => Math.min(imageCapability.maxCount, current + 1))}
                  >
                    +
                  </button>
                </div>
              ) : null}
              <ComingSoonControl label={t('private')} icon={<Lock className="size-4" />} badgeLabel={t('comingSoon')} />
              <ComingSoonControl label={t('draw')} icon={<Pencil className="size-4" />} badgeLabel={t('comingSoon')} />
            </div>
          </div>

          <MagneticLink
            href={composerHref}
            onClick={handleComposerClick}
            className="growth-generator-generate inline-flex min-h-24 flex-col items-center justify-center gap-1 rounded-md bg-growth-accent px-5 text-lg font-black text-background hover:bg-foreground"
          >
            <span className="inline-flex items-center gap-2">
              {t('generate')}
              <Sparkles className="size-5 fill-background" />
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
      </SpotlightPanel>
    </div>
  );
}
