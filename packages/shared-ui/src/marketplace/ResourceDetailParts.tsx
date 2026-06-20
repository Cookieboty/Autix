'use client';

import { useMemo } from 'react';
import type { ReactNode, SyntheticEvent } from 'react';
import { useTranslations } from 'next-intl';
import { ExternalLink } from 'lucide-react';
import { FallbackImage } from '../template/FallbackImage';
import { cn } from '../ui/utils';
import { getVideoPreviewUrl, useTimedVideoPreview } from './VideoHoverPreview';
import type {
  DetailVisualVariant,
  ResourceDetailItem,
} from './resource-detail-types';

export function panelStyle(variant: DetailVisualVariant) {
  if (variant === 'immersive') {
    return undefined;
  }
  return {
    backgroundColor: 'var(--panel)',
    border: '1px solid var(--border)',
  };
}

export function DetailMedia({
  resource,
  isVideoTemplate,
  enableVideoPreview,
  variant,
}: {
  resource: ResourceDetailItem;
  isVideoTemplate: boolean;
  enableVideoPreview: boolean;
  variant: DetailVisualVariant;
}) {
  const t = useTranslations('marketplace');
  const previewUrl = useMemo(
    () => (isVideoTemplate && enableVideoPreview ? getVideoPreviewUrl(resource) : null),
    [enableVideoPreview, isVideoTemplate, resource],
  );
  const { previewRef, startPreview, stopPreview } =
    useTimedVideoPreview(previewUrl);
  const isImmersive = variant === 'immersive';

  return (
    <div
      className={cn(
        'group relative aspect-[4/3] overflow-hidden',
        isImmersive ? 'bg-black/30' : 'bg-[var(--panel-muted)]',
      )}
      onPointerEnter={startPreview}
      onPointerLeave={stopPreview}
      onFocus={startPreview}
      onBlur={stopPreview}
      tabIndex={previewUrl ? 0 : undefined}
    >
      <FallbackImage
        src={resource.coverImage}
        alt={resource.title}
        className={cn(
          'h-full w-full object-cover transition-all duration-500',
          isImmersive && 'group-hover:scale-[1.025]',
          previewUrl && 'group-hover:opacity-0',
        )}
        fallbackText={t('common.noCover')}
      />
      {previewUrl && (
        <video
          ref={previewRef}
          className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          src={previewUrl}
          muted
          playsInline
          preload="metadata"
          poster={resource.coverImage ?? undefined}
          onEnded={stopPreview}
          onError={stopPreview}
          onLoadedData={(event: SyntheticEvent<HTMLVideoElement>) => {
            event.currentTarget.currentTime = 0;
          }}
        />
      )}
      {isImmersive && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/18 via-transparent to-black/64" />
      )}
      {isVideoTemplate && isImmersive && (
        <div
          className={cn(
            'pointer-events-none absolute inset-0 flex items-center justify-center transition-all duration-300 group-hover:scale-105',
            previewUrl && 'group-hover:opacity-0',
          )}
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/28 bg-white/20 text-white shadow-2xl backdrop-blur-md">
            <span className="ml-1 h-0 w-0 border-y-[10px] border-l-[16px] border-y-transparent border-l-white" />
          </span>
        </div>
      )}
      {previewUrl && (
        <div className="pointer-events-none absolute bottom-4 left-4 rounded-full border border-white/14 bg-black/40 px-3 py-1 text-xs text-white/72 backdrop-blur-md">
          {t('detail.hoverPreview')}
        </div>
      )}
    </div>
  );
}

export function DetailSection({
  title,
  variant,
  className,
  children,
}: {
  title: ReactNode;
  variant: DetailVisualVariant;
  className?: string;
  children: ReactNode;
}) {
  const isImmersive = variant === 'immersive';

  return (
    <div className={className}>
      <div
        className={cn(
          'rounded-lg p-5',
          isImmersive && 'border border-white/12 bg-white/[0.075] shadow-xl backdrop-blur-xl',
        )}
        style={panelStyle(variant)}
      >
        <h2
          className={cn(
            'mb-3 text-sm font-semibold',
            isImmersive && 'text-white',
          )}
          style={isImmersive ? undefined : { color: 'var(--foreground)' }}
        >
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

export function Info({
  label,
  value,
  variant,
}: {
  label: string;
  value: ReactNode;
  variant: DetailVisualVariant;
}) {
  return (
    <div>
      <InfoLabel variant={variant}>{label}</InfoLabel>
      <InfoValue variant={variant}>{value}</InfoValue>
    </div>
  );
}

export function InfoLabel({
  variant,
  children,
}: {
  variant: DetailVisualVariant;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(variant === 'immersive' && 'text-white/48')}
      style={variant === 'immersive' ? undefined : { color: 'var(--muted)' }}
    >
      {children}
    </div>
  );
}

export function InfoValue({
  variant,
  children,
}: {
  variant: DetailVisualVariant;
  children: ReactNode;
}) {
  return (
    <div
      className={cn('break-all', variant === 'immersive' && 'text-white')}
      style={variant === 'immersive' ? undefined : { color: 'var(--foreground)' }}
    >
      {children}
    </div>
  );
}

export function SourceLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-blue-500 hover:underline"
    >
      {children}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}
