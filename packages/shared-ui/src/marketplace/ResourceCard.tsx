'use client';

import { useMemo } from 'react';
import type { CSSProperties, SyntheticEvent } from 'react';
import {
  Bot,
  Boxes,
  Clapperboard,
  Coins,
  CornerDownRight,
  Eye,
  Heart,
  ImageIcon,
  Monitor,
  Play,
  Sparkles,
} from 'lucide-react';
import type {
  AnyResource,
  AgentKind,
  ResourceType,
  RuntimeReq,
} from '@autix/shared-lib';
import { FallbackImage } from '../template/FallbackImage';
import { KIND_ICON, KIND_LABEL } from '../chat/agent-kind-utils';
import { getVideoPreviewUrl, useTimedVideoPreview } from './VideoHoverPreview';

const TYPE_LABEL: Record<ResourceType, string> = {
  SKILL: 'Skill',
  MCP: 'MCP',
  AGENT: 'Agent',
  IMAGE_TEMPLATE: '图片模板',
  VIDEO_TEMPLATE: '视频模板',
};

const TYPE_BADGE_COLOR: Record<ResourceType, string> = {
  SKILL: '#7c3aed',
  MCP: '#0891b2',
  AGENT: '#0ea5e9',
  IMAGE_TEMPLATE: '#22c55e',
  VIDEO_TEMPLATE: '#f59e0b',
};

const TYPE_META: Record<
  ResourceType,
  {
    accent: string;
    accentSoft: string;
    glow: string;
    icon: typeof Sparkles;
    kicker: string;
  }
> = {
  SKILL: {
    accent: '#8b5cf6',
    accentSoft: 'rgba(139, 92, 246, 0.16)',
    glow: 'rgba(139, 92, 246, 0.28)',
    icon: Sparkles,
    kicker: 'Skill Pack',
  },
  MCP: {
    accent: '#06b6d4',
    accentSoft: 'rgba(6, 182, 212, 0.16)',
    glow: 'rgba(6, 182, 212, 0.26)',
    icon: Boxes,
    kicker: 'Connector',
  },
  AGENT: {
    accent: '#0ea5e9',
    accentSoft: 'rgba(14, 165, 233, 0.17)',
    glow: 'rgba(14, 165, 233, 0.3)',
    icon: Bot,
    kicker: 'AgentHub',
  },
  IMAGE_TEMPLATE: {
    accent: '#22c55e',
    accentSoft: 'rgba(34, 197, 94, 0.16)',
    glow: 'rgba(34, 197, 94, 0.28)',
    icon: ImageIcon,
    kicker: 'Image Recipe',
  },
  VIDEO_TEMPLATE: {
    accent: '#f97316',
    accentSoft: 'rgba(249, 115, 22, 0.16)',
    glow: 'rgba(249, 115, 22, 0.3)',
    icon: Clapperboard,
    kicker: 'Video Flow',
  },
};

const MASONRY_RATIOS = [
  'aspect-[4/5]',
  'aspect-[1/1]',
  'aspect-[5/7]',
  'aspect-[4/3]',
  'aspect-[3/4]',
  'aspect-[6/7]',
] as const;

const FALLBACK_VIDEO_RATIOS = [
  '9 / 16',
  '16 / 9',
  '1 / 1',
  '4 / 5',
  '21 / 9',
  '3 / 4',
] as const;

interface ResourceCardItem {
  id: string;
  title: string;
  category: string;
  coverImage?: string;
  description?: string;
  tags?: string[];
  useCount: number;
  likeCount: number;
  viewCount: number;
  pointsCost: number;
  runtimeRequirement: RuntimeReq;
  resourceType?: ResourceType;
  kind?: AgentKind;
}

interface AgentCardDetails {
  executionMode?: 'single' | 'workflow';
  toolBindings?: {
    mcps?: string[];
    skills?: string[];
  };
}

interface VideoCardDetails {
  exampleMedia?: string[];
  defaultParams?: {
    ratio?: string;
    resolution?: string;
  };
  externalMetadata?: Record<string, unknown>;
}

function parsePositiveNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value !== 'string') return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function ratioFromPair(width: unknown, height: unknown): string | null {
  const w = parsePositiveNumber(width);
  const h = parsePositiveNumber(height);
  return w && h ? `${w} / ${h}` : null;
}

function normalizeRatio(value: unknown): string | null {
  if (typeof value === 'number') {
    return value > 0 ? `${value} / 1` : null;
  }
  if (typeof value !== 'string') return null;

  const raw = value.trim().toLowerCase();
  if (!raw) return null;
  if (raw.includes('portrait') || raw.includes('vertical')) return '9 / 16';
  if (raw.includes('landscape') || raw.includes('horizontal')) return '16 / 9';
  if (raw.includes('square')) return '1 / 1';

  const pair = raw.match(/(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)/);
  if (pair) return ratioFromPair(pair[1], pair[2]);

  const decimal = parsePositiveNumber(raw);
  return decimal ? `${decimal} / 1` : null;
}

function normalizeResolution(value: unknown): string | null {
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return (
      ratioFromPair(record.width, record.height) ??
      ratioFromPair(record.w, record.h) ??
      null
    );
  }
  if (typeof value !== 'string') return null;

  const raw = value.trim().toLowerCase();
  const pair = raw.match(/(\d{2,5})\s*(?:x|×|\*)\s*(\d{2,5})/);
  if (pair) return ratioFromPair(pair[1], pair[2]);
  if (raw.includes('portrait') || raw.includes('vertical')) return '9 / 16';
  if (raw.includes('landscape') || raw.includes('horizontal')) return '16 / 9';
  return null;
}

function videoAspectRatio(
  resource: ResourceCardItem & VideoCardDetails,
  index: number,
): string {
  const metadata = resource.externalMetadata ?? {};
  return (
    normalizeRatio(resource.defaultParams?.ratio) ??
    normalizeResolution(resource.defaultParams?.resolution) ??
    normalizeRatio(metadata.ratio) ??
    normalizeRatio(metadata.aspectRatio) ??
    normalizeRatio(metadata.aspect_ratio) ??
    normalizeResolution(metadata.resolution) ??
    normalizeResolution(metadata.dimensions) ??
    normalizeResolution(metadata.size) ??
    ratioFromPair(metadata.width, metadata.height) ??
    ratioFromPair(metadata.videoWidth, metadata.videoHeight) ??
    ratioFromPair(metadata.w, metadata.h) ??
    FALLBACK_VIDEO_RATIOS[index % FALLBACK_VIDEO_RATIOS.length]
  );
}

export function ResourceCard({
  resource,
  resourceType,
  onClick,
  onUseTemplate,
  onUseTemplateInChat,
  onUseTemplateInWorkbench,
  index = 0,
  variant = 'default',
}: {
  resource: ResourceCardItem | AnyResource;
  resourceType?: ResourceType;
  onClick?: () => void;
  onUseTemplate?: () => void;
  onUseTemplateInChat?: () => void;
  onUseTemplateInWorkbench?: () => void;
  index?: number;
  variant?: 'default' | 'masonry';
}) {
  const r = resource as ResourceCardItem;
  const type = (r.resourceType ?? resourceType ?? 'IMAGE_TEMPLATE') as ResourceType;
  const meta = TYPE_META[type];
  const Icon = meta.icon;
  const isFree = (r.pointsCost ?? 0) === 0;
  const desktopOnly = r.runtimeRequirement === 'DESKTOP_ONLY';
  const isMasonry = variant === 'masonry';
  const videoRatio =
    type === 'VIDEO_TEMPLATE' && isMasonry
      ? videoAspectRatio(r as ResourceCardItem & VideoCardDetails, index)
      : null;
  const previewUrl = useMemo(
    () =>
      type === 'VIDEO_TEMPLATE'
        ? getVideoPreviewUrl(r as ResourceCardItem & VideoCardDetails)
        : null,
    [r, type],
  );
  const { previewRef, startPreview, stopPreview } =
    useTimedVideoPreview(previewUrl);
  const mediaRatio = videoRatio
    ? ''
    : isMasonry
    ? type === 'VIDEO_TEMPLATE'
      ? 'aspect-video'
      : type === 'AGENT'
        ? MASONRY_RATIOS[(index + 2) % MASONRY_RATIOS.length]
        : MASONRY_RATIOS[index % MASONRY_RATIOS.length]
    : 'aspect-[4/3]';
  const mediaStyle: CSSProperties | undefined = videoRatio
    ? { aspectRatio: videoRatio }
    : undefined;
  const tags = Array.isArray(r.tags) ? r.tags.slice(0, 3) : [];
  const agent = r as ResourceCardItem & AgentCardDetails;
  const toolCount =
    type === 'AGENT'
      ? (agent.toolBindings?.mcps?.length ?? 0) +
        (agent.toolBindings?.skills?.length ?? 0)
      : 0;
  const chatAction = onUseTemplateInChat ?? onUseTemplate;
  const workbenchAction = onUseTemplateInWorkbench;
  const hasTemplateAction = Boolean(chatAction || workbenchAction);

  return (
    <div
      className="group relative cursor-pointer overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-transparent hover:shadow-2xl"
      onClick={onClick}
      onPointerEnter={startPreview}
      onPointerLeave={stopPreview}
      onFocus={startPreview}
      onBlur={stopPreview}
      style={{
        boxShadow: `0 18px 46px -34px ${meta.glow}`,
      }}
    >
      <div className="pointer-events-none absolute inset-0 z-20 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div
          className="absolute inset-0 rounded-lg"
          style={{
            boxShadow: `inset 0 0 0 1px ${meta.glow}, 0 0 0 2px ${meta.accent}`,
          }}
        />
      </div>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-24 opacity-70 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `linear-gradient(110deg, transparent 0%, ${meta.glow} 38%, transparent 72%)`,
        }}
      />

      <div
        className={`relative ${mediaRatio} overflow-hidden bg-muted`}
        style={mediaStyle}
      >
        <FallbackImage
          src={r.coverImage}
          alt={r.title}
          className={`h-full w-full object-cover transition-all duration-500 group-hover:scale-105 ${
            previewUrl ? 'group-hover:opacity-0' : ''
          }`}
          fallbackText={'暂无封面'}
        />
        {previewUrl && (
          <video
            ref={previewRef}
            className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            src={previewUrl}
            muted
            playsInline
            preload="metadata"
            poster={r.coverImage}
            onClick={(event) => event.preventDefault()}
            onEnded={stopPreview}
            onError={stopPreview}
            onLoadedData={(event: SyntheticEvent<HTMLVideoElement>) => {
              event.currentTarget.currentTime = 0;
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/42 via-transparent to-black/82" />
        <div
          className="absolute inset-x-0 top-0 h-24 opacity-70"
          style={{
            background: `linear-gradient(180deg, ${meta.glow}, transparent)`,
          }}
        />

        <div className="absolute left-3 top-3 z-10 flex flex-wrap items-center gap-2">
          <div
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white shadow-lg backdrop-blur-md"
            style={{ backgroundColor: TYPE_BADGE_COLOR[type] }}
          >
            <Icon className="h-3.5 w-3.5" />
            {TYPE_LABEL[type]}
          </div>
          {desktopOnly && (
            <div className="flex items-center gap-1 rounded-full bg-black/46 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-md">
              <Monitor className="h-3 w-3" /> 桌面
            </div>
          )}
        </div>

        {type === 'VIDEO_TEMPLATE' && (
          <div
            className={`absolute inset-0 flex items-center justify-center opacity-90 transition-all duration-300 group-hover:scale-105 ${
              previewUrl ? 'group-hover:opacity-0' : ''
            }`}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/28 bg-white/22 text-white shadow-2xl backdrop-blur-md">
              <Play className="ml-0.5 h-5 w-5 fill-white" />
            </span>
          </div>
        )}

        {type === 'AGENT' && (
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 text-white">
            <span className="rounded-full border border-white/18 bg-black/42 px-2.5 py-1 text-[11px] backdrop-blur-md">
              {agent.executionMode === 'workflow' ? 'Workflow Agent' : meta.kicker}
            </span>
            {toolCount > 0 && (
              <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-950">
                {toolCount} tools
              </span>
            )}
          </div>
        )}

        {hasTemplateAction && (
          <div className="absolute inset-x-3 bottom-3 z-10 translate-y-0 opacity-100 transition-all duration-300 ease-out sm:translate-y-[calc(100%-0.5rem)] sm:opacity-90 sm:group-hover:translate-y-0 sm:group-hover:opacity-100 sm:group-focus-within:translate-y-0 sm:group-focus-within:opacity-100">
            <div className="grid gap-1.5 sm:grid-cols-2">
              {chatAction && (
                <button
                  type="button"
                  className="flex h-8 cursor-pointer items-center justify-between gap-2 rounded-md border border-white/22 bg-black/62 px-2.5 text-left text-[11px] font-semibold text-white shadow-[0_12px_34px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-all duration-200 hover:border-white/36 hover:bg-black/76 active:scale-[0.98] sm:h-9 sm:px-3"
                  onClick={(e) => {
                    e.stopPropagation();
                    chatAction();
                  }}
                  onPointerEnter={(e) => e.stopPropagation()}
                  aria-label={`在会话中使用模板 ${r.title}`}
                >
                  <span className="min-w-0 truncate">会话使用</span>
                  <span
                    className="flex size-5 shrink-0 items-center justify-center rounded-full text-white sm:size-6"
                    style={{ backgroundColor: meta.accent }}
                  >
                    <CornerDownRight className="size-3.5" />
                  </span>
                </button>
              )}
              {workbenchAction && (
                <button
                  type="button"
                  className="flex h-8 cursor-pointer items-center justify-between gap-2 rounded-md border border-white/22 bg-white/90 px-2.5 text-left text-[11px] font-semibold text-slate-950 shadow-[0_12px_34px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-all duration-200 hover:bg-white active:scale-[0.98] sm:h-9 sm:px-3"
                  onClick={(e) => {
                    e.stopPropagation();
                    workbenchAction();
                  }}
                  onPointerEnter={(e) => e.stopPropagation()}
                  aria-label={`应用到专业工作台 ${r.title}`}
                >
                  <span className="min-w-0 truncate">专业工作台</span>
                  <span
                    className="flex size-5 shrink-0 items-center justify-center rounded-full text-white sm:size-6"
                    style={{ backgroundColor: meta.accent }}
                  >
                    <CornerDownRight className="size-3.5" />
                  </span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="relative z-10 space-y-3 p-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
              {r.title}
            </p>
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: meta.accent }}
            />
          </div>
          <p className="line-clamp-2 min-h-8 text-xs leading-4 text-muted-foreground">
            {r.description || `${r.category} · ${meta.kicker}`}
          </p>
        </div>

        <div className="flex min-h-6 flex-wrap items-center gap-1.5">
          {type === 'AGENT' && r.kind && (
            <span
              className="shrink-0 rounded-full px-2 py-1 text-[10px] font-medium"
              style={{ backgroundColor: meta.accentSoft, color: meta.accent }}
            >
              {KIND_ICON[r.kind]} {KIND_LABEL[r.kind]}
            </span>
          )}
          <span className="rounded-full bg-secondary px-2 py-1 text-[10px] text-muted-foreground">
            {r.category || '精选'}
          </span>
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-border/70 px-2 py-1 text-[10px] text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2 border-t border-border/70 pt-3">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
            style={{
              backgroundColor: isFree ? '#16a34a' : meta.accent,
            }}
          >
            {!isFree && <Coins className="h-3 w-3" />}
            {isFree ? '免费' : `${r.pointsCost} 积分`}
          </span>
          <span className="flex-1" />
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Eye className="h-3 w-3" /> {r.viewCount ?? 0}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Heart className="h-3 w-3" /> {r.likeCount}
          </span>
        </div>
      </div>
    </div>
  );
}
