'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ClipboardEvent, MouseEvent } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowUpRight,
  Box,
  Check,
  ChevronDown,
  Clock3,
  Coins,
  Copy,
  Crop,
  Diamond,
  Eye,
  Filter,
  Heart,
  History,
  Image as ImageIcon,
  ImagePlus,
  Info,
  Loader2,
  Lock,
  Music,
  Pencil,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Upload,
  UserRound,
  Video,
  Volume2,
  WandSparkles,
  X,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { createPortal } from 'react-dom';
import {
  buildImageSizeResolutionGroups,
  detectImageModelKind,
  IMAGE_MODEL_CAPABILITIES,
  resolveImageSizeSelection,
  selectImageSizeResolution,
  type ImageModelCapability,
} from '@autix/domain/image';
import {
  hasImageCapability,
  isVideoModel,
  type ImageTemplate,
  type ImageWorkbenchHistoryItem,
  imageWorkbenchActions,
  listPublicAvailableModels,
  videoWorkbenchActions,
  type ModelConfigItem,
} from '@autix/shared-store';
import Link from 'next/link';
import { ComingSoonControl } from './ComingSoonControl';
import { getFallbackItems } from './fallback';
import { MagneticButton, MagneticLink, SpotlightPanel } from './GrowthInteractions';
import {
  findImageModelByHint,
  resolveImageCapabilityFromModelParam,
  getImageCountControl,
  getImageReferenceUploadLimit,
} from './generator-image-presenters';
import { buildGeneratorWorkbenchHref } from './generator-workbench-href';
import { buildImageWorkbenchEstimateInput } from '../image/workbench/pricing';
import { readFilesAsDataUrls, resolveTemplatePrompt } from '../image/studio/constants';
import {
  DEFAULT_PUBLIC_VIDEO_MODEL,
  buildPublicVideoEstimateInput,
  findVideoModelByHint,
  getVideoReferenceUploadLimit,
  resolveVideoCapabilityFromModelConfig,
} from './generator-video-presenters';
import {
  DEFAULT_VIDEO_PARAMS,
  RATIO_VALUES,
} from '../video/workbench/constants';
import { MediaThumb } from './MediaBlocks';
import { PublicGeneratorAppNav } from './PublicGeneratorAppNav';
import { PublicPromoBar } from './PublicPromoBar';
import type { PublicGrowthMediaItem } from './types';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

type GeneratorKind = 'image' | 'video';
type ImageStudioMode = 'history' | 'templates';
type TemplateDensity = 'relaxed' | 'normal' | 'dense';
type PublicUploadedReference = {
  id: string;
  url: string;
  name: string;
};
type PublicVideoReference = PublicUploadedReference & {
  sourceType?: 'upload' | 'image_generation';
  sourceId?: string;
  prompt?: string;
};
type PublicVideoMediaTab = 'uploads' | 'generations';
const PUBLIC_IMAGE_DRAFT_STORAGE_PREFIX = 'autix:public-image-draft:';
const PUBLIC_VIDEO_DRAFT_STORAGE_PREFIX = 'autix:public-video-draft:';
const TEMPLATE_DENSITY_VALUES: TemplateDensity[] = ['relaxed', 'normal', 'dense'];
const TEMPLATE_DENSITY_WALL_CLASS: Record<TemplateDensity, string> = {
  relaxed: 'columns-1 gap-3 sm:columns-2 lg:columns-3 2xl:columns-4',
  normal: 'columns-2 gap-2 md:columns-4 xl:columns-5',
  dense: 'columns-2 gap-1.5 md:columns-5 xl:columns-6',
};
const TEMPLATE_DENSITY_SKELETON_CLASS: Record<TemplateDensity, string> = {
  relaxed: 'grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4',
  normal: 'grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-5',
  dense: 'grid-cols-2 gap-1.5 md:grid-cols-5 xl:grid-cols-6',
};

function getImageCapabilityForModel(model: ModelConfigItem | null, fallback: ImageModelCapability) {
  if (!model) return fallback;
  return IMAGE_MODEL_CAPABILITIES[detectImageModelKind(model)];
}

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

function createPublicImageDraftId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function writePublicImageDraftUploads(refs: PublicUploadedReference[]) {
  if (typeof window === 'undefined' || refs.length === 0) return null;
  const draftId = createPublicImageDraftId();
  try {
    window.sessionStorage.setItem(
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

function limitPublicVideoReferences(refs: PublicVideoReference[], limit: number) {
  if (limit <= 0) return [];
  return refs.slice(-limit);
}

function writePublicVideoDraftMaterials(refs: PublicVideoReference[]) {
  if (typeof window === 'undefined' || refs.length === 0) return null;
  const draftId = createPublicImageDraftId();
  try {
    window.sessionStorage.setItem(
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

function flattenImageHistoryReferences(history: ImageWorkbenchHistoryItem[]): PublicVideoReference[] {
  return history.flatMap((item) => {
    const images = item.images?.length
      ? item.images
      : item.generatedImages.map((url, index) => ({
        url,
        index,
        generationId: item.id,
        prompt: item.resolvedPrompt,
      }));
    return images
      .filter((image) => typeof image.url === 'string' && image.url.trim())
      .map((image) => ({
        id: `history-${image.generationId ?? item.id}-${image.index}`,
        url: image.url,
        name: item.resolvedPrompt || `Generation ${image.index + 1}`,
        prompt: image.prompt ?? item.resolvedPrompt,
        sourceType: 'image_generation' as const,
        sourceId: image.generationId ?? item.id,
      }));
  });
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

function publicVideoMediaLabels(locale: string) {
  const isZh = locale.toLowerCase().startsWith('zh');
  return isZh
    ? {
      uploads: '上传素材',
      generations: '历史生成',
      uploadImages: '上传图片',
      pasteHint: '支持点击上传或粘贴图片',
      checkEligibility: '可引用',
      useImage: '引用素材',
      filter: '筛选',
      selected: '已选择 {count} / {limit}',
      emptyHistory: '暂无生成图片',
      loadingHistory: '正在加载生成图片...',
      done: '完成',
      remove: '移除',
    }
    : {
      uploads: 'Uploads',
      generations: 'Generations',
      uploadImages: 'Upload Images',
      pasteHint: 'Click to upload or paste images',
      checkEligibility: 'Use image',
      useImage: 'Use image',
      filter: 'Filter',
      selected: 'Selected {count} / {limit}',
      emptyHistory: 'No generated images yet',
      loadingHistory: 'Loading generated images...',
      done: 'Done',
      remove: 'Remove',
    };
}

function repeatedItems(items: PublicGrowthMediaItem[], count: number) {
  if (!items.length) return [];
  return Array.from({ length: count }, (_, index) => items[index % items.length]!);
}

function ModeTabs({
  active,
  onChange,
}: {
  active: ImageStudioMode;
  onChange: (next: ImageStudioMode) => void;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const tabs = [
    { id: 'history' as const, label: t('history'), icon: History },
    { id: 'templates' as const, label: t('templates'), icon: WandSparkles },
  ];

  return (
    <div className="inline-flex rounded-md border border-white/5 bg-white/[0.035] p-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`inline-flex min-h-10 items-center gap-2 rounded-md px-4 text-sm font-semibold transition ${active === tab.id ? 'bg-white/8 text-white' : 'text-white/45 hover:bg-white/5 hover:text-white/76'
              }`}
          >
            <Icon className="size-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function OfferStrip({
  label,
  premium,
  className = '',
}: {
  label: string;
  premium: string;
  className?: string;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const [open, setOpen] = useState(true);
  if (!open) return null;

  return (
    <div
      className={`flex min-h-10 items-center gap-2 rounded-[10px] border border-[#ff3b8d]/25 bg-[linear-gradient(90deg,#be0a52,#7d113f_58%,#32101d)] px-3 text-xs font-semibold text-white shadow-[0_14px_46px_rgb(0_0_0/0.28)] ${className}`}
    >
      <span className="rounded-[7px] bg-[#c9ff00] px-2 py-1 text-[10px] font-black uppercase text-black">
        {t('goUnlimited')}
      </span>
      <span className="rounded-[7px] bg-[#ff1675] px-2 py-1 text-[10px] font-black text-white">
        30% OFF
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="hidden text-white/40 md:inline">{premium}</span>
      <a
        href="/pricing"
        className="inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-[8px] bg-white px-2.5 text-xs font-bold text-black hover:bg-[#c9ff00]"
      >
        {t('getUnlimited')}
        <ArrowUpRight className="size-3.5" />
      </a>
      <button
        type="button"
        className="grid size-7 shrink-0 place-items-center rounded-[8px] text-white/45 hover:bg-white/10 hover:text-white"
        aria-label={t('close')}
        onClick={() => setOpen(false)}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

function StudioDensitySlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: TemplateDensity;
  onChange: (value: TemplateDensity) => void;
}) {
  return (
    <div
      className="flex items-center gap-1 rounded-full bg-black/28 px-2 py-2 shadow-[0_12px_36px_rgb(0_0_0/0.22)] backdrop-blur-md"
      role="group"
      aria-label={label}
    >
      {TEMPLATE_DENSITY_VALUES.map((option, index) => {
        const active = option === value;
        return (
          <button
            key={option}
            type="button"
            aria-label={`${label} ${index + 1}`}
            aria-pressed={active}
            className="grid h-5 w-8 cursor-pointer place-items-center rounded-full transition hover:bg-white/10"
            onClick={() => onChange(option)}
          >
            <span
              className={`h-1 rounded-full transition-all ${active ? 'w-6 bg-white shadow-[0_0_14px_rgb(255_255_255/0.45)]' : 'w-4 bg-white/16'}`}
            />
          </button>
        );
      })}
    </div>
  );
}

function ImageHeroCollage({ items }: { items: PublicGrowthMediaItem[] }) {
  const collage = repeatedItems(items, 4);
  return (
    <div className="relative mx-auto mb-5 h-48 w-full max-w-[650px] md:h-52">
      <div className="absolute inset-x-[14%] top-12 h-28 rounded-full bg-[#78a7ff]/10 blur-3xl" />
      {collage.map((item, index) => (
        <a
          key={`${item.id}-${index}`}
          href={item.href}
          className={`growth-generator-card absolute top-6 block overflow-hidden rounded-md border-[5px] border-white/20 bg-black shadow-[0_28px_90px_rgb(40_120_255/0.16)] transition duration-500 hover:z-10 hover:scale-105 ${index === 0
            ? 'left-[2%] h-[7.5rem] w-[29%] -rotate-8'
            : index === 1
              ? 'left-[27%] h-36 w-[27%] rotate-3'
              : index === 2
                ? 'left-[51%] h-36 w-[22%] rounded-full'
                : 'right-[2%] h-[7.5rem] w-[29%] -rotate-3'
            }`}
          style={{ animationDelay: `${index * 160}ms` }}
          aria-label={item.title}
        >
          <MediaThumb item={item} eager={index < 2} autoPlay={index === 0} />
        </a>
      ))}
    </div>
  );
}

function imageTemplateCover(template: ImageTemplate) {
  return template.coverImage || template.exampleImages?.[0] || null;
}

function formatTemplateMetric(value?: number | null) {
  const count = Math.max(0, value ?? 0);
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(count >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(count >= 10_000 ? 0 : 1).replace(/\.0$/, '')}K`;
  }
  return String(count);
}

function PublicImageTemplateWall({
  templates,
  loading,
  density,
  onSelectTemplate,
  onUseTemplate,
}: {
  templates: ImageTemplate[];
  loading: boolean;
  density: TemplateDensity;
  onSelectTemplate: (template: ImageTemplate) => void;
  onUseTemplate: (template: ImageTemplate) => void;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const previewTemplates = templates.slice(0, 24);
  const scrollFrameClass =
    'pointer-events-auto absolute inset-x-0 bottom-0 top-0 overflow-y-auto overscroll-contain pb-[370px] pt-16 [scrollbar-gutter:stable]';

  if (loading) {
    return (
      <div className={scrollFrameClass}>
        <div className={`pointer-events-none grid opacity-75 ${TEMPLATE_DENSITY_SKELETON_CLASS[density]}`}>
          {Array.from({ length: 12 }, (_, index) => (
            <div
              key={index}
              className="h-56 animate-pulse rounded-md bg-white/[0.055]"
              style={{ animationDelay: `${(index % 6) * 90}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (previewTemplates.length === 0) {
    return (
      <div className={scrollFrameClass}>
        <div className="flex justify-center px-4 pt-16">
          <div className="rounded-md border border-white/10 bg-black/38 px-5 py-4 text-sm font-semibold text-white/48 backdrop-blur">
            {t('templatesEmpty')}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={scrollFrameClass}>
      <div className={`opacity-95 ${TEMPLATE_DENSITY_WALL_CLASS[density]}`}>
        {previewTemplates.map((template, index) => {
          const cover = imageTemplateCover(template);
          const author = template.authorName || template.authorUrl || t('unknownAuthor');
          const handleUseTemplate = (event: MouseEvent<HTMLButtonElement>) => {
            event.stopPropagation();
            onUseTemplate(template);
          };
          return (
            <article
              key={template.id}
              className="growth-generator-masonry group relative mb-2 block w-full break-inside-avoid overflow-hidden rounded-md bg-white/[0.04] text-left transition duration-300 hover:scale-[1.01] hover:brightness-110"
              style={{ animationDelay: `${(index % 9) * 80}ms` }}
            >
              {cover ? (
                <img
                  src={cover}
                  alt={template.title}
                  loading={index < 8 ? 'eager' : 'lazy'}
                  className="block h-auto w-full"
                />
              ) : (
                <div className="grid aspect-[3/4] w-full place-items-center bg-white/[0.05] text-white/32">
                  <ImageIcon className="size-10" />
                </div>
              )}
              <button
                type="button"
                aria-label={template.title}
                className="absolute inset-0 z-10 cursor-pointer"
                onClick={() => onSelectTemplate(template)}
              >
                <span className="sr-only">{template.title}</span>
              </button>
              <div className="pointer-events-none absolute inset-0 z-20 bg-[linear-gradient(180deg,rgba(0,0,0,0.72),rgba(0,0,0,0.08)_42%,rgba(0,0,0,0.74))] opacity-0 transition duration-200 group-hover:opacity-100 group-focus-within:opacity-100" />
              <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex translate-y-[-6px] items-start justify-between gap-2 p-3 opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
                <span className="inline-flex min-w-0 items-center gap-2 rounded-full bg-black/36 px-2.5 py-1.5 text-xs font-bold text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12)] backdrop-blur-md">
                  <UserRound className="size-3.5 shrink-0" />
                  <span className="truncate">{author}</span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/14 px-2.5 py-1.5 text-sm font-black text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.18)] backdrop-blur-md">
                  <Heart className="size-4" />
                  {formatTemplateMetric(template.likeCount)}
                </span>
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex translate-y-2 items-end justify-between gap-3 p-3 opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
                <div className="min-w-0">
                  <span className="mb-1 inline-flex rounded-md bg-[#c9ff00] px-2 py-1 text-[10px] font-black uppercase text-black">
                    {template.category || t('templates')}
                  </span>
                  <p className="line-clamp-2 text-sm font-black text-white">{template.title}</p>
                </div>
                <div className="pointer-events-none flex shrink-0 flex-col items-end gap-2 group-hover:pointer-events-auto group-focus-within:pointer-events-auto">
                  <span className="inline-flex items-center gap-1 rounded-full bg-black/36 px-2.5 py-1.5 text-xs font-bold text-white/86 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12)] backdrop-blur-md">
                    <Eye className="size-3.5" />
                    {formatTemplateMetric(template.viewCount)}
                  </span>
                  <button
                    type="button"
                    className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-md bg-[#c9ff00] px-4 text-sm font-black text-black shadow-[0_12px_34px_rgb(0_0_0/0.32)] transition duration-200 hover:bg-white"
                    onClick={handleUseTemplate}
                  >
                    {t('usePrompt')}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function PublicImageTemplateDialog({
  template,
  onClose,
  onUsePrompt,
}: {
  template: ImageTemplate | null;
  onClose: () => void;
  onUsePrompt: (template: ImageTemplate) => void;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const [copied, setCopied] = useState(false);
  const cover = template ? imageTemplateCover(template) : null;
  const prompt = template ? resolveTemplatePrompt(template) || template.prompt : '';

  useEffect(() => {
    if (!template) return;
    setCopied(false);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, template]);

  if (!template) return null;

  const copyPrompt = () => {
    if (!prompt || typeof navigator === 'undefined' || !navigator.clipboard) return;
    void navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    });
  };

  const author = template.authorName || template.authorUrl || t('unknownAuthor');

  return (
    <div
      className="fixed inset-0 z-[80] flex bg-black/82 text-white backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-label={template.title}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label={t('close')}
        onClick={onClose}
      />
      <div className="relative z-10 grid min-h-0 w-full grid-cols-1 gap-4 p-4 md:grid-cols-[minmax(0,1fr)_390px] md:p-6">
        <div className="relative flex min-h-[52svh] items-center justify-center overflow-hidden rounded-md bg-white/[0.035]">
          {cover ? (
            <img
              src={cover}
              alt={template.title}
              className="max-h-[calc(100svh-3rem)] max-w-full rounded-md object-contain"
            />
          ) : (
            <div className="grid size-40 place-items-center rounded-md bg-white/[0.05] text-white/36">
              <ImageIcon className="size-12" />
            </div>
          )}
        </div>

        <aside className="flex min-h-0 flex-col rounded-md border border-white/10 bg-[#111413]/96 p-4 shadow-[0_20px_70px_rgb(0_0_0/0.45)]">
          <div className="mb-6 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#c9ff00] text-black">
                <WandSparkles className="size-5" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-base font-black">{template.title}</h2>
                <p className="truncate text-sm font-semibold text-white/45">{author}</p>
              </div>
            </div>
            <button
              type="button"
              className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-md text-white/50 hover:bg-white/8 hover:text-white"
              aria-label={t('close')}
              onClick={onClose}
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <section className="rounded-md bg-white/[0.035] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="inline-flex items-center gap-2 text-xs font-black uppercase text-white/50">
                  <Sparkles className="size-4" />
                  {t('prompt')}
                </h3>
                <button
                  type="button"
                  className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-md border border-white/10 px-3 text-xs font-bold text-white/72 hover:bg-white/8 hover:text-white"
                  onClick={copyPrompt}
                >
                  <Copy className="size-3.5" />
                  {copied ? t('copied') : t('copyPrompt')}
                </button>
              </div>
              <p className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md bg-black/18 p-3 text-sm font-medium leading-6 text-white/62">
                {prompt || t('noPrompt')}
              </p>
            </section>

            <section className="rounded-md bg-white/[0.035] p-4">
              <h3 className="mb-3 inline-flex items-center gap-2 text-xs font-black uppercase text-white/50">
                <Info className="size-4" />
                {t('information')}
              </h3>
              <div className="divide-y divide-white/8 text-sm">
                <TemplateInfoRow label={t('model')} value={template.modelHint || t('auto')} />
                <TemplateInfoRow label={t('category')} value={template.category || '-'} />
                <TemplateInfoRow label={t('usageCount')} value={String(template.useCount ?? 0)} />
              </div>
            </section>
          </div>

          <button
            type="button"
            className="mt-5 inline-flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-[#c9ff00] px-4 text-base font-black text-black shadow-[0_0_28px_rgb(201_255_0/0.2)] hover:bg-white"
            onClick={() => onUsePrompt(template)}
          >
            <WandSparkles className="size-5" />
            {t('usePrompt')}
          </button>
        </aside>
      </div>
    </div>
  );
}

function TemplateInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 py-2">
      <span className="text-white/42">{label}</span>
      <span className="min-w-0 truncate text-right font-bold text-white/78">{value}</span>
    </div>
  );
}

function ImageComposer({
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
        window.sessionStorage.removeItem(draftStorageKeyRef.current);
        draftStorageKeyRef.current = null;
      }
      setDraftId(null);
      return;
    }
    if (draftStorageKeyRef.current) {
      window.sessionStorage.removeItem(draftStorageKeyRef.current);
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
      <SpotlightPanel className="mx-auto rounded-md border border-white/10 bg-[#181b1c]/95 p-4 shadow-[0_22px_80px_rgb(0_0_0/0.45)] backdrop-blur-xl md:p-5">
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
            <div className={`rounded-md text-sm text-white/48 ${hasUploadedRefs ? 'space-y-4' : 'flex min-h-12 items-start gap-3'}`}>
              {hasUploadedRefs ? (
                <div className="flex flex-wrap items-center gap-3">
                  {uploadedRefs.map((ref) => (
                    <div
                      key={ref.id}
                      className="group relative size-20 overflow-hidden rounded-md border border-white/10 bg-black/40"
                    >
                      <img
                        src={ref.url}
                        alt={ref.name}
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        aria-label={t('close')}
                        className="absolute right-1 top-1 grid size-6 cursor-pointer place-items-center rounded-md bg-black/65 text-white/70 opacity-0 transition hover:bg-black hover:text-white group-hover:opacity-100"
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
                      className="grid size-20 cursor-pointer place-items-center rounded-md border border-white/8 bg-white/[0.045] text-white transition hover:border-[#c9ff00]/45 hover:bg-white/[0.075] hover:text-[#c9ff00] disabled:cursor-not-allowed disabled:opacity-45"
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
                  className={`grid size-9 shrink-0 place-items-center rounded-md border border-[#c9ff00]/35 bg-[#c9ff00]/5 text-[#c9ff00] transition hover:bg-[#c9ff00]/12 ${canUploadReference ? 'cursor-pointer' : 'cursor-not-allowed opacity-45'}`}
                  disabled={!canUploadReference || uploading}
                  onClick={openUploadDialog}
                >
                  {uploading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                </button>
              )}
              <textarea
                ref={promptTextareaRef}
                rows={1}
                className="min-h-6 max-h-48 min-w-0 flex-1 resize-none overflow-hidden bg-transparent text-base leading-6 text-white outline-none placeholder:text-white/44"
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
                <div className="inline-flex min-h-10 items-center rounded-md border border-white/8 bg-black/22 text-sm font-semibold text-white/78">
                  <button
                    type="button"
                    aria-label={t('decreaseCount')}
                    className="grid size-10 place-items-center rounded-l-md text-white/45 hover:bg-white/8 hover:text-white"
                    onClick={() => setCount((current) => Math.max(1, current - 1))}
                  >
                    -
                  </button>
                  <span className="min-w-14 px-2 text-center">{count}/{imageCapability.maxCount}</span>
                  <button
                    type="button"
                    aria-label={t('increaseCount')}
                    className="grid size-10 place-items-center rounded-r-md text-white/45 hover:bg-white/8 hover:text-white"
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
            className="growth-generator-generate inline-flex min-h-24 flex-col items-center justify-center gap-1 rounded-md bg-[#c9ff00] px-5 text-lg font-black text-black shadow-[0_0_34px_rgb(201_255_0/0.22)] hover:bg-white"
          >
            <span className="inline-flex items-center gap-2">
              {t('generate')}
              <Sparkles className="size-5 fill-black" />
            </span>
            {estimateLoading ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-black/60">
                <Loader2 className="size-3 animate-spin" />
              </span>
            ) : estimateCost != null ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-black/66">
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

function ImageParamButton({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/8 bg-black/22 px-3 text-sm font-semibold text-white/78">
      <span className="text-[#c9ff00]">{icon}</span>
      <span>{label}</span>
      <ChevronDown className="size-3.5 text-white/38" />
    </span>
  );
}

function ImageModelParamMenu({
  icon,
  label,
  models,
  selectedModelId,
  loading,
  onChange,
  fallbackLabel,
}: {
  icon: ReactNode;
  label: string;
  models: ModelConfigItem[];
  selectedModelId: string | null;
  loading: boolean;
  onChange: (modelId: string) => void;
  fallbackLabel: string;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const [open, setOpen] = useState(false);

  if (models.length === 0) {
    return (
      <ImageParamButton
        icon={icon}
        label={loading ? t('modelLoading') : label || fallbackLabel}
      />
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="cursor-pointer text-left">
          <ImageParamButton icon={icon} label={label} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 gap-0 overflow-hidden rounded-md border-white/10 bg-[#171918] p-1 text-white shadow-[0_20px_70px_rgb(0_0_0/0.45)]"
      >
        <div className="px-3 py-2 text-xs font-semibold text-white/45">{t('selectModel')}</div>
        <div className="max-h-72 overflow-y-auto">
          {models.map((model) => (
            <button
              key={model.id}
              type="button"
              onClick={() => {
                onChange(model.id);
                setOpen(false);
              }}
              className={`flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-md px-3 text-left transition ${selectedModelId === model.id
                ? 'bg-white/12 text-[#c9ff00]'
                : 'text-white/82 hover:bg-white/8'
                }`}
            >
              <Sparkles className="size-4 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{model.name}</span>
                <span className="block truncate text-xs text-white/38">
                  {model.model} · {model.provider}
                </span>
              </span>
              {selectedModelId === model.id ? <Check className="size-4 shrink-0" /> : null}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ImageOptionParamMenu({
  icon,
  label,
  title,
  options,
  value,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  title: string;
  options: Array<{ label: string; value: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  if (options.length <= 1) {
    return <ImageParamButton icon={icon} label={label} />;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="cursor-pointer text-left">
          <ImageParamButton icon={icon} label={label} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 gap-0 overflow-hidden rounded-md border-white/10 bg-[#171918] p-1 text-white shadow-[0_20px_70px_rgb(0_0_0/0.45)]"
      >
        <div className="px-3 py-2 text-xs font-semibold text-white/45">{title}</div>
        <div className="max-h-72 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-md px-3 text-left text-sm font-semibold transition ${value === option.value
                ? 'bg-white/12 text-[#c9ff00]'
                : 'text-white/82 hover:bg-white/8'
                }`}
            >
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              {value === option.value ? <Check className="size-4 shrink-0" /> : null}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ImageGeneratorStudio({
  items,
  imageCapability,
  imageModels,
  selectedModel,
  selectedModelId,
  selectedModelValue,
  modelsLoading,
  onModelChange,
}: {
  items: PublicGrowthMediaItem[];
  imageCapability: ImageModelCapability;
  imageModels: ModelConfigItem[];
  selectedModel: ModelConfigItem | null;
  selectedModelId: string | null;
  selectedModelValue?: string | null;
  modelsLoading: boolean;
  onModelChange: (modelId: string) => void;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const [mode, setMode] = useState<ImageStudioMode>('history');
  const templateMode = mode === 'templates';
  const [templateDensity, setTemplateDensity] = useState<TemplateDensity>('normal');
  const [templates, setTemplates] = useState<ImageTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ImageTemplate | null>(null);
  const [appliedTemplate, setAppliedTemplate] = useState<{
    id: string;
    title: string;
    prompt: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTemplatesLoading(true);
    imageWorkbenchActions
      .listTemplates({ sort: 'popular', pageSize: 60 })
      .then((items) => {
        if (!cancelled) setTemplates(items);
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      })
      .finally(() => {
        if (!cancelled) setTemplatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const useTemplatePrompt = (template: ImageTemplate) => {
    const prompt = resolveTemplatePrompt(template) || template.prompt;
    setAppliedTemplate({
      id: `${template.id}:${Date.now()}`,
      title: template.title,
      prompt,
    });
    setSelectedTemplate(null);
  };

  return (
    <main className="relative min-h-[calc(100svh-104px)] overflow-hidden bg-[#080a09]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_48%_34%,rgba(61,100,125,0.16),transparent_32%),linear-gradient(180deg,#101312,#080a09_46%,#111415)]" />
      <div className="growth-generator-noise absolute inset-0 opacity-[0.13]" />
      {templateMode ? (
        <PublicImageTemplateWall
          templates={templates}
          loading={templatesLoading}
          density={templateDensity}
          onSelectTemplate={setSelectedTemplate}
          onUseTemplate={useTemplatePrompt}
        />
      ) : null}
      {templateMode ? <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(8,10,9,0.05),rgba(8,10,9,0.18)_55%,rgba(8,10,9,0.86))]" /> : null}

      <div className="relative z-10 flex items-start justify-between gap-3 px-1 pt-3 md:px-2">
        <ModeTabs active={mode} onChange={setMode} />
        {templateMode ? (
          <StudioDensitySlider
            label={t('density')}
            value={templateDensity}
            onChange={setTemplateDensity}
          />
        ) : null}
      </div>

      {!templateMode ? (
        <section className="relative z-10 mx-auto flex min-h-[calc(100svh-374px)] max-w-4xl flex-col items-center justify-center px-4 pb-12 pt-12 text-center">
          <ImageHeroCollage items={items} />
          <h1 className="text-4xl font-black uppercase leading-[0.96] tracking-normal text-white md:text-5xl">
            {t('imageBlankTitle')}
            <span className="block text-[#c9ff00]">{t('imageBlankAccent', { model: selectedModel?.name ?? imageCapability.displayName })}</span>
          </h1>
          <p className="mt-4 max-w-xl text-base font-medium text-white/42">
            {t('imageBlankDescription')}
          </p>
        </section>
      ) : (
        <section className="pointer-events-none relative z-10 min-h-[calc(100svh-320px)]" aria-label={t('templateMode')} />
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-[30px] z-40">
        <ImageComposer
          communityMode={templateMode}
          imageCapability={imageCapability}
          imageModels={imageModels}
          selectedModel={selectedModel}
          selectedModelId={selectedModelId}
          selectedModelValue={selectedModelValue}
          modelsLoading={modelsLoading}
          appliedTemplate={appliedTemplate}
          onModelChange={onModelChange}
        />
      </div>
      <PublicImageTemplateDialog
        template={selectedTemplate}
        onClose={() => setSelectedTemplate(null)}
        onUsePrompt={useTemplatePrompt}
      />
    </main>
  );
}

function PublicVideoMediaDialog({
  open,
  selectedRefs,
  limit,
  onAddRefs,
  onRemoveRef,
  onClose,
}: {
  open: boolean;
  selectedRefs: PublicVideoReference[];
  limit: number;
  onAddRefs: (refs: PublicVideoReference[]) => void;
  onRemoveRef: (id: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const locale = useLocale();
  const labels = useMemo(() => publicVideoMediaLabels(locale), [locale]);
  const [tab, setTab] = useState<PublicVideoMediaTab>('uploads');
  const [uploading, setUploading] = useState(false);
  const [historyRefs, setHistoryRefs] = useState<PublicVideoReference[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const remaining = Math.max(0, limit - selectedRefs.length);
  const selectedUrls = useMemo(
    () => new Set(selectedRefs.map((ref) => ref.url)),
    [selectedRefs],
  );

  useEffect(() => {
    if (!open || tab !== 'generations') return;
    let cancelled = false;
    setHistoryLoading(true);
    imageWorkbenchActions
      .listHistory({ pageSize: 40 })
      .then((items) => {
        if (!cancelled) setHistoryRefs(flattenImageHistoryReferences(items));
      })
      .catch(() => {
        if (!cancelled) setHistoryRefs([]);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, tab]);

  if (!open) return null;

  const handleFiles = async (files: FileList | File[] | null) => {
    if (!files || remaining <= 0 || uploading) return;
    const imageFiles = Array.from(files)
      .filter((file) => file.type.startsWith('image/'))
      .slice(0, remaining);
    if (imageFiles.length === 0) return;
    setUploading(true);
    try {
      const urls = await readFilesAsDataUrls(imageFiles);
      const stamp = Date.now();
      onAddRefs(
        urls.map((url, index) => ({
          id: `video-upload-${stamp}-${index}`,
          url,
          name: imageFiles[index]?.name ?? labels.uploadImages,
          sourceType: 'upload',
        })),
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    if (remaining <= 0) return;
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
    void handleFiles(files);
  };

  const addHistoryRef = (ref: PublicVideoReference) => {
    if (selectedUrls.has(ref.url)) {
      onRemoveRef(ref.id);
      return;
    }
    if (remaining <= 0) return;
    onAddRefs([ref]);
  };

  const selectedCountLabel = labels.selected
    .replace('{count}', String(selectedRefs.length))
    .replace('{limit}', String(limit));
  const bodyTitle = tab === 'uploads' ? labels.uploads : labels.generations;
  const emptyUploadSlots = Math.max(0, Math.min(7, limit - selectedRefs.length - 1));

  return createPortal(
    <div
      className="fixed inset-0 z-[80] bg-black/35 text-white backdrop-blur-[1.5px]"
      onPaste={handlePaste}
    >
      <div className="fixed inset-x-3 bottom-3 flex max-h-[calc(100svh-1.5rem)] flex-col overflow-hidden rounded-[22px] border border-white/[0.09] bg-[#151716]/88 shadow-[0_24px_80px_rgb(0_0_0/0.5),inset_0_1px_0_rgb(255_255_255/0.045)] ring-1 ring-black/35 backdrop-blur-2xl md:inset-x-5 md:bottom-5 md:top-auto md:max-h-none lg:left-[max(332px,calc((100vw-1800px)/2+360px))] lg:right-auto lg:top-[clamp(238px,42vh,304px)] lg:h-[min(420px,calc(100svh-clamp(238px,42vh,304px)-18px))] lg:w-[min(600px,calc(100vw-max(332px,calc((100vw-1800px)/2+360px))-24px))] xl:w-[min(640px,calc(100vw-max(332px,calc((100vw-1800px)/2+360px))-32px))]">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => void handleFiles(event.target.files)}
        />
        <div className="flex h-[54px] shrink-0 items-center justify-between gap-2 border-b border-white/[0.075] bg-[#111312]/72 px-3 md:h-[58px]">
          <div className="inline-flex min-w-0 items-center gap-1.5">
            {[
              { value: 'uploads' as const, label: labels.uploads },
              { value: 'generations' as const, label: labels.generations },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setTab(item.value)}
                className={`min-h-9 cursor-pointer rounded-full px-4 text-sm font-bold transition ${tab === item.value
                  ? 'bg-white text-black shadow-[0_10px_28px_rgb(255_255_255/0.08)]'
                  : 'text-white/68 hover:bg-white/[0.07] hover:text-white'
                  }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-label={t('close')}
            onClick={onClose}
            className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full bg-white/[0.075] text-white/70 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)] transition hover:bg-white/12 hover:text-white"
          >
            <X className="size-[18px]" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(150deg,rgba(43,45,44,0.94),rgba(27,29,28,0.96)_55%,rgba(31,33,32,0.94))] p-3 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.18)_transparent]">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <span className="text-sm font-semibold text-white/42">{bodyTitle}</span>
            <div className="inline-flex items-center gap-2">
              <span className="hidden rounded-full bg-black/24 px-2.5 py-1 text-xs font-semibold text-white/42 sm:inline">
                {selectedCountLabel}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.055] px-2.5 py-1 text-xs font-bold text-white/58">
                <Filter className="size-3.5" />
                {labels.filter}
              </span>
            </div>
          </div>
          {tab === 'uploads' ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={remaining <= 0 || uploading}
                className="group relative col-span-2 flex min-h-[136px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[15px] border border-white/[0.065] bg-[linear-gradient(145deg,rgba(255,255,255,0.095),rgba(255,255,255,0.035))] p-4 text-center shadow-[inset_0_1px_0_rgb(255_255_255/0.055),0_16px_38px_rgb(0_0_0/0.18)] transition hover:border-[#c9ff00]/38 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-[144px]"
              >
                <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.09),transparent_42%)] opacity-80" />
                <span className="relative grid size-12 place-items-center rounded-full bg-white/[0.075] text-white/58 shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_10px_26px_rgb(0_0_0/0.24)] transition group-hover:scale-105 group-hover:text-white">
                  {uploading ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-6" />}
                </span>
                <span className="relative mt-4 text-base font-bold">{labels.uploadImages}</span>
                <span className="relative mt-2 max-w-[18rem] text-xs font-semibold leading-5 text-white/38">{labels.pasteHint}</span>
              </button>
              {selectedRefs.map((ref) => (
                <div
                  key={ref.id}
                  className="group relative aspect-square overflow-hidden rounded-[15px] border border-[#c9ff00]/50 bg-black shadow-[0_18px_32px_rgb(0_0_0/0.22)]"
                >
                  <img src={ref.url} alt={ref.name} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.78))] opacity-75" />
                  <button
                    type="button"
                    aria-label={labels.remove}
                    onClick={() => onRemoveRef(ref.id)}
                    className="absolute right-2 top-2 grid size-8 cursor-pointer place-items-center rounded-full bg-black/62 text-white/75 transition hover:bg-black hover:text-white"
                  >
                    <X className="size-4" />
                  </button>
                  <div className="absolute inset-x-3 bottom-3 truncate text-sm font-bold text-white">
                    {ref.name}
                  </div>
                </div>
              ))}
              {Array.from({ length: emptyUploadSlots }).map((_, index) => (
                <div
                  key={`empty-upload-slot-${index}`}
                  aria-hidden="true"
                  className="aspect-square rounded-[15px] border border-white/[0.035] bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.055),transparent_58%),linear-gradient(145deg,rgba(255,255,255,0.045),rgba(255,255,255,0.016))] shadow-[inset_0_1px_0_rgb(255_255_255/0.035)]"
                />
              ))}
            </div>
          ) : historyLoading ? (
            <div className="grid min-h-72 place-items-center text-sm font-semibold text-white/45">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                {labels.loadingHistory}
              </span>
            </div>
          ) : historyRefs.length === 0 ? (
            <div className="grid min-h-72 place-items-center rounded-[18px] border border-dashed border-white/10 text-sm font-semibold text-white/42">
              {labels.emptyHistory}
            </div>
          ) : (
            <div className="columns-1 gap-3 sm:columns-2 lg:columns-3 xl:columns-4 [column-fill:_balance]">
              {historyRefs.map((ref) => {
                const selected = selectedUrls.has(ref.url);
                return (
                  <button
                    key={ref.id}
                    type="button"
                    onClick={() => addHistoryRef(ref)}
                    disabled={!selected && remaining <= 0}
                    className={`group relative mb-3 block w-full overflow-hidden rounded-[18px] border bg-black text-left transition duration-200 disabled:cursor-not-allowed disabled:opacity-45 ${selected
                      ? 'border-[#c9ff00] ring-2 ring-[#c9ff00]/25'
                      : 'border-white/8 hover:border-white/20'
                      }`}
                  >
                    <img src={ref.url} alt={ref.name} className="h-auto w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,rgba(0,0,0,0.8))]" />
                    <span className="absolute inset-x-3 bottom-3 flex min-h-9 items-center justify-center rounded-full bg-white/88 px-3 text-sm font-black text-black">
                      {selected ? labels.done : labels.checkEligibility}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
function VideoSidebar({
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
        window.sessionStorage.removeItem(draftStorageKeyRef.current);
        draftStorageKeyRef.current = null;
      }
      setDraftId(null);
      return;
    }
    if (draftStorageKeyRef.current) {
      window.sessionStorage.removeItem(draftStorageKeyRef.current);
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
    <aside className="flex rounded-[16px] border border-white/[0.085] bg-[#111413]/92 shadow-[0_18px_70px_rgb(0_0_0/0.32),inset_0_1px_0_rgb(255_255_255/0.035)] lg:sticky lg:top-24 lg:h-[calc(100svh-8rem)] lg:flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-3 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.18)_transparent]">
        <div className="mb-3 flex items-center gap-4 border-b border-white/[0.075] pb-2.5">
          <button
            type="button"
            className="relative min-h-8 px-0 text-sm font-bold text-white after:absolute after:inset-x-0 after:-bottom-[11px] after:h-0.5 after:rounded-full after:bg-white"
          >
            {t('createVideo')}
          </button>
          {[t('editVideo'), t('motionControl')].map((label) => (
            <span
              key={label}
              aria-disabled="true"
              title={t('comingSoon')}
              className="inline-flex min-h-8 cursor-not-allowed items-center text-sm font-semibold text-white/42"
            >
              {label}
            </span>
          ))}
        </div>

        {preview ? (
          <Link href={sidebarHref} className="group relative block aspect-[16/5.8] cursor-pointer overflow-hidden rounded-[13px] border border-white/[0.075] bg-black">
            <MediaThumb item={preview} eager autoPlay className="opacity-70 transition duration-500 group-hover:scale-[1.04]" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.82))]" />
            <div className="absolute inset-x-3 bottom-3">
              <div className="text-lg font-black uppercase leading-none text-[#c9ff00]">{t('generalPreset')}</div>
              <div className="mt-1 truncate text-[11px] font-semibold text-white/58">{modelLabel}</div>
            </div>
            <span className="absolute right-2 top-2 rounded-[8px] bg-black/50 px-2 py-1 text-[11px] font-bold text-white/84 backdrop-blur-sm">
              {t('change')}
            </span>
          </Link>
        ) : null}

        <button
          type="button"
          onClick={() => setMediaDialogOpen(true)}
          className="group relative mt-2.5 grid min-h-[82px] w-full cursor-pointer place-items-center overflow-hidden rounded-[13px] border border-white/[0.075] bg-[#1b1e1d] p-3 text-center text-sm text-white/48 shadow-[inset_0_1px_0_rgb(255_255_255/0.045)] transition hover:border-white/12 hover:bg-[#202322] hover:text-white"
        >
          <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.07),transparent_42%)] opacity-80" />
          {hasVideoRefs ? (
            <span className="relative grid w-full grid-cols-4 gap-2">
              {selectedVideoRefs.slice(0, 4).map((ref) => (
                <span
                  key={ref.id}
                  className="relative aspect-square overflow-hidden rounded-[10px] border border-white/10 bg-black"
                >
                  <img src={ref.url} alt={ref.name} className="h-full w-full object-cover" />
                </span>
              ))}
              {selectedVideoRefs.length < uploadLimit ? (
                <span className="grid aspect-square place-items-center rounded-[10px] border border-dashed border-white/16 bg-white/[0.045]">
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
                    className="grid size-7 place-items-center rounded-full border border-white/10 bg-white/[0.075] text-white/44 shadow-[0_10px_20px_rgb(0_0_0/0.2)] transition group-hover:text-white/70"
                    style={{ zIndex: index + 1 }}
                  >
                    <Icon className="size-3" />
                  </span>
                ))}
              </span>
              <span className="relative text-sm font-semibold leading-none text-white/60">{t('uploadMedia')}</span>
              <span className="relative mt-1 block text-xs font-medium text-white/42">{t('uploadMediaHint')}</span>
            </>
          )}
          {hasVideoRefs ? (
            <span className="mt-2 block text-xs font-semibold text-[#c9ff00]">
              {selectedVideoRefs.length}/{uploadLimit}
            </span>
          ) : null}
        </button>

        <label className="mt-2.5 block rounded-[13px] border border-white/[0.075] bg-white/[0.04] p-3 shadow-[inset_0_1px_0_rgb(255_255_255/0.025)]">
          <span className="text-xs font-bold text-white/42">{t('prompt')}</span>
          <textarea
            className="mt-1.5 min-h-[58px] w-full resize-none bg-transparent text-sm leading-6 text-white outline-none placeholder:text-white/36"
            placeholder={t('videoPromptPlaceholder')}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMediaDialogOpen(true)}
              className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full bg-black/38 px-2.5 py-1 text-xs font-bold text-white/72 hover:bg-black/55"
            >
              @ {t('elements')}
            </button>
            <button
              type="button"
              onClick={() => setGenerateAudio((prev) => !prev)}
              className={`inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold transition ${generateAudio ? 'bg-[#c9ff00]/15 text-[#c9ff00]' : 'bg-black/38 text-white/38 line-through'}`}
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

      <div className="border-t border-white/[0.065] bg-[#101211]/88 px-3 pb-3 pt-2.5 lg:shrink-0">
        <MagneticLink
          href={sidebarHref}
          onClick={(event) => handleVideoWorkbenchClick(event)}
          className="growth-generator-generate flex min-h-12 w-full flex-col items-center justify-center gap-0.5 rounded-[13px] bg-[#c9ff00] px-4 text-sm font-black text-black shadow-[0_0_28px_rgb(201_255_0/0.2)] hover:bg-white"
        >
          <span className="inline-flex items-center gap-2">
            {t('generate')}
            <Sparkles className="size-4 fill-black" />
          </span>
          {estimateLoading ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-black/60">
              <Loader2 className="size-3 animate-spin" />
            </span>
          ) : estimateCost != null ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-black/66">
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
function VideoParamButton({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-[11px] border border-white/[0.075] bg-white/[0.05] px-2 text-xs font-bold text-white/78 transition hover:bg-white/[0.08]">
      <span className="shrink-0 text-white/52">{icon}</span>
      <span className="min-w-0 truncate leading-none">{label}</span>
    </span>
  );
}

function VideoModelParamMenu({
  icon,
  label,
  models,
  selectedModelId,
  loading,
  onChange,
  fallbackLabel,
}: {
  icon: ReactNode;
  label: string;
  models: ModelConfigItem[];
  selectedModelId: string | null;
  loading: boolean;
  onChange: (modelId: string) => void;
  fallbackLabel: string;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const [open, setOpen] = useState(false);

  if (models.length === 0) {
    return (
      <VideoStaticParamRow
        icon={icon}
        label={t('model')}
        value={loading ? t('modelLoading') : label || fallbackLabel}
        highlight
      />
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="min-w-0 cursor-pointer text-left"
        >
          <VideoStaticParamRow
            icon={icon}
            label={t('model')}
            value={label}
            highlight
            trailing={<ChevronDown className="size-4 shrink-0 text-white/45" />}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 gap-0 overflow-hidden rounded-md border-white/10 bg-[#171918] p-1 text-white shadow-[0_20px_70px_rgb(0_0_0/0.45)]"
      >
        <div className="px-3 py-2 text-xs font-semibold text-white/45">{t('selectModel')}</div>
        <div className="max-h-72 overflow-y-auto">
          {models.map((model) => (
            <button
              key={model.id}
              type="button"
              onClick={() => {
                onChange(model.id);
                setOpen(false);
              }}
              className={`flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-md px-3 text-left transition ${selectedModelId === model.id
                ? 'bg-white/12 text-[#c9ff00]'
                : 'text-white/82 hover:bg-white/8'
                }`}
            >
              <Video className="size-4 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{model.name}</span>
                <span className="block truncate text-xs text-white/38">
                  {model.model} · {model.provider}
                </span>
              </span>
              {selectedModelId === model.id ? <Check className="size-4 shrink-0" /> : null}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function VideoOptionParamMenu({
  icon,
  label,
  title,
  options,
  value,
  onChange,
}: {
  icon?: ReactNode;
  label: string;
  title: string;
  options: Array<{ label: string; value: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  if (options.length <= 1) {
    return (
      <button type="button" className="min-w-0 cursor-default text-left" disabled>
        <VideoParamButton icon={icon ?? <SlidersHorizontal className="size-4" />} label={label} />
      </button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="min-w-0 cursor-pointer text-left">
          <VideoParamButton icon={icon ?? <SlidersHorizontal className="size-4" />} label={label} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 gap-0 overflow-hidden rounded-md border-white/10 bg-[#171918] p-1 text-white shadow-[0_20px_70px_rgb(0_0_0/0.45)]"
      >
        <div className="px-3 py-2 text-xs font-semibold text-white/45">{title}</div>
        <div className="max-h-80 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-md px-3 text-left text-sm font-semibold transition ${value === option.value
                ? 'bg-white/12 text-[#c9ff00]'
                : 'text-white/82 hover:bg-white/8'
                }`}
            >
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              {value === option.value ? <Check className="size-4 shrink-0" /> : null}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function VideoStaticParamRow({
  label,
  value,
  highlight = false,
  icon,
  trailing,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  icon?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-2 rounded-[11px] border border-white/[0.075] bg-white/[0.05] px-2.5 text-left text-xs">
      <span className="inline-flex min-w-0 items-center gap-1.5 font-semibold text-white/62">
        {icon ? <span className="shrink-0 text-white/42">{icon}</span> : null}
        <span className="truncate">{label}</span>
      </span>
      <span className="ml-auto inline-flex min-w-0 items-center gap-2">
        <span className={highlight ? 'min-w-0 truncate font-black text-[#c9ff00]' : 'min-w-0 truncate font-semibold text-white/60'}>{value}</span>
        {trailing}
      </span>
    </div>
  );
}

function VideoHowItWorks({
  items,
  workbenchHref,
}: {
  items: PublicGrowthMediaItem[];
  workbenchHref: string;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const cards = [
    {
      title: t('addImage'),
      body: t('addImageBody'),
      item: items[0],
      label: t('uploadImage'),
      icon: Upload,
    },
    {
      title: t('choosePreset'),
      body: t('choosePresetBody'),
      item: items[1],
      label: t('choosePreset'),
      icon: WandSparkles,
    },
    {
      title: t('getVideo'),
      body: t('getVideoBody'),
      item: items[2],
      label: t('getVideo'),
      icon: Video,
    },
  ];

  return (
    <main className="min-w-0 flex-1 px-3 pb-2 pt-2 lg:px-4">
      <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
        <div className="inline-flex rounded-[11px] border border-white/[0.055] bg-white/[0.035] p-1 shadow-[inset_0_1px_0_rgb(255_255_255/0.03)]">
          <button className="inline-flex min-h-8 items-center gap-1.5 rounded-[9px] px-3 text-xs font-bold text-white/42">
            <History className="size-3.5" />
            {t('history')}
          </button>
          <button className="inline-flex min-h-8 items-center gap-1.5 rounded-[9px] bg-white/[0.085] px-3 text-xs font-bold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.035)]">
            <Box className="size-3.5" />
            {t('howItWorks')}
          </button>
        </div>
      </div>

      <OfferStrip label={t('videoOffer')} premium={t('premiumPlans')} />

      <SpotlightPanel className="mt-2 rounded-[13px] border border-white/[0.075] bg-[#111313] p-4 shadow-[0_20px_70px_rgb(0_0_0/0.28)] md:p-4">
        <div className="growth-scan pointer-events-none absolute inset-x-0 top-0 h-20 opacity-14" />
        <div className="mb-3">
          <h1 className="text-3xl font-black uppercase leading-none md:text-[40px]">
            {t('videoHeroTitle')}
          </h1>
          <p className="mt-1.5 max-w-4xl text-xs font-semibold leading-5 text-white/42 md:text-sm">
            {t('videoHeroDescription')}
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          {cards.map((card, index) => {
            const Icon = card.icon;
            return (
              <a key={card.title} href={workbenchHref} className="group block">
                <div className="growth-generator-video-card relative aspect-[16/10.4] overflow-hidden rounded-[12px] border border-white/[0.075] bg-black">
                  {card.item ? (
                    <MediaThumb item={card.item} eager={index === 0} autoPlay={index === 0} className="opacity-82 transition duration-700 group-hover:scale-[1.04]" />
                  ) : null}
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.62))]" />
                  <div className="absolute inset-7 rounded-[10px] border border-dashed border-white/16 bg-black/12" />
                  <div className="absolute left-1/2 top-1/2 grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[11px] border border-white/18 bg-black/45 text-white backdrop-blur">
                    <Icon className="size-6" />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-3">
                    <span className="inline-flex rounded-[8px] bg-[#c9ff00] px-2 py-1 text-[10px] font-black uppercase text-black">
                      {card.label}
                    </span>
                  </div>
                </div>
                <h2 className="mt-2.5 text-lg font-black uppercase">{card.title}</h2>
                <p className="mt-1 text-xs font-medium leading-5 text-white/45">{card.body}</p>
              </a>
            );
          })}
        </div>
      </SpotlightPanel>
    </main>
  );
}

function VideoGeneratorStudio({
  items,
  workbenchHref,
  initialModel,
  videoModels,
  selectedModel,
  selectedModelId,
  selectedModelValue,
  modelsLoading,
  onModelChange,
}: {
  items: PublicGrowthMediaItem[];
  workbenchHref: string;
  initialModel?: string | null;
  videoModels: ModelConfigItem[];
  selectedModel: ModelConfigItem | null;
  selectedModelId: string | null;
  selectedModelValue?: string | null;
  modelsLoading: boolean;
  onModelChange: (modelId: string) => void;
}) {
  return (
    <div className="relative min-h-[calc(100svh-104px)] bg-[#080a09]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_8%,rgba(201,255,0,0.06),transparent_24%),linear-gradient(180deg,#080a09,#0c0f0e)]" />
      <div className="growth-generator-noise absolute inset-0 opacity-[0.1]" />
      <div className="relative z-10 mx-auto flex max-w-[1800px] flex-col gap-3 px-4 py-3 lg:flex-row lg:px-6">
        <div className="lg:w-[320px] lg:shrink-0">
          <VideoSidebar
            items={items}
            initialModel={initialModel}
            videoModels={videoModels}
            selectedModel={selectedModel}
            selectedModelId={selectedModelId}
            selectedModelValue={selectedModelValue}
            modelsLoading={modelsLoading}
            onModelChange={onModelChange}
          />
        </div>
        <VideoHowItWorks items={items} workbenchHref={workbenchHref} />
      </div>
    </div>
  );
}

export function PublicGeneratorStudioView({
  kind,
  examples,
  initialModel,
}: {
  kind: GeneratorKind;
  examples?: PublicGrowthMediaItem[] | null;
  initialModel?: string | null;
}) {
  const t = useTranslations('publicGrowth');
  const items = useMemo(
    () => (examples?.length ? examples : getFallbackItems(t)).filter((item) => item.mediaUrl),
    [examples, t],
  );
  const fallbackImageCapability = useMemo(
    () => resolveImageCapabilityFromModelParam(initialModel),
    [initialModel],
  );
  const [imageModels, setImageModels] = useState<ModelConfigItem[]>([]);
  const [selectedImageModelId, setSelectedImageModelId] = useState<string | null>(null);
  const [imageModelsLoading, setImageModelsLoading] = useState(kind === 'image');
  const [videoModels, setVideoModels] = useState<ModelConfigItem[]>([]);
  const [selectedVideoModelId, setSelectedVideoModelId] = useState<string | null>(null);
  const [videoModelsLoading, setVideoModelsLoading] = useState(kind === 'video');
  const selectedImageModel = imageModels.find((model) => model.id === selectedImageModelId) ?? null;
  const selectedVideoModel = videoModels.find((model) => model.id === selectedVideoModelId) ?? null;
  const imageCapability = useMemo(
    () => getImageCapabilityForModel(selectedImageModel, fallbackImageCapability),
    [fallbackImageCapability, selectedImageModel],
  );
  const selectedImageModelValue = selectedImageModel?.id ?? initialModel ?? null;
  const selectedVideoModelValue = selectedVideoModel?.id ?? initialModel ?? null;
  const workbenchHref = buildGeneratorWorkbenchHref({
    kind: 'video',
    model: selectedVideoModelValue ?? DEFAULT_PUBLIC_VIDEO_MODEL,
  });

  useEffect(() => {
    if (kind !== 'image') {
      setImageModelsLoading(false);
      return;
    }

    let cancelled = false;
    setImageModelsLoading(true);
    listPublicAvailableModels()
      .then((models) => {
        if (cancelled) return;
        const candidates = models.filter((model) => hasImageCapability(model.capabilities ?? []));
        setImageModels(candidates);
        const preferred =
          findImageModelByHint(candidates, initialModel) ??
          candidates.find((model) => model.isDefault) ??
          candidates[0] ??
          null;
        setSelectedImageModelId((current) =>
          current && candidates.some((model) => model.id === current)
            ? current
            : preferred?.id ?? null,
        );
      })
      .catch(() => {
        if (!cancelled) {
          setImageModels([]);
          setSelectedImageModelId(null);
        }
      })
      .finally(() => {
        if (!cancelled) setImageModelsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initialModel, kind]);

  useEffect(() => {
    if (kind !== 'video') {
      setVideoModelsLoading(false);
      return;
    }

    let cancelled = false;
    setVideoModelsLoading(true);
    listPublicAvailableModels()
      .then((models) => {
        if (cancelled) return;
        const candidates = models.filter(isVideoModel);
        setVideoModels(candidates);
        const preferred =
          findVideoModelByHint(candidates, initialModel) ??
          candidates.find((model) => model.isDefault) ??
          candidates[0] ??
          null;
        setSelectedVideoModelId((current) =>
          current && candidates.some((model) => model.id === current)
            ? current
            : preferred?.id ?? null,
        );
      })
      .catch(() => {
        if (!cancelled) {
          setVideoModels([]);
          setSelectedVideoModelId(null);
        }
      })
      .finally(() => {
        if (!cancelled) setVideoModelsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initialModel, kind]);

  return (
    <div className="min-h-svh bg-[#080a09] pt-[104px] text-white">
      <div className="fixed inset-x-0 top-0 z-50">
        <PublicPromoBar label={t('generator.studio.topPromo')} href="/pricing" />
        <PublicGeneratorAppNav kind={kind} />
      </div>
      {kind === 'video' ? (
        <VideoGeneratorStudio
          items={items}
          workbenchHref={workbenchHref}
          initialModel={initialModel}
          videoModels={videoModels}
          selectedModel={selectedVideoModel}
          selectedModelId={selectedVideoModelId}
          selectedModelValue={selectedVideoModelValue}
          modelsLoading={videoModelsLoading}
          onModelChange={setSelectedVideoModelId}
        />
      ) : (
        <ImageGeneratorStudio
          items={items}
          imageCapability={imageCapability}
          imageModels={imageModels}
          selectedModel={selectedImageModel}
          selectedModelId={selectedImageModelId}
          selectedModelValue={selectedImageModelValue}
          modelsLoading={imageModelsLoading}
          onModelChange={setSelectedImageModelId}
        />
      )}
    </div>
  );
}
