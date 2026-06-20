'use client';

import type { ReactNode } from 'react';
import { MarketplaceTopNav } from './MarketplaceTopNav';
import { cn } from '../ui/utils';

type MarketplaceRouteStateTone =
  | 'public-list'
  | 'web-muted'
  | 'web-error'
  | 'desktop-muted'
  | 'desktop-error';

function contentClassName(tone: MarketplaceRouteStateTone) {
  if (tone === 'public-list') {
    return 'bg-[linear-gradient(180deg,#020617_0%,#08111f_100%)] text-white/58';
  }
  if (tone === 'web-error') {
    return 'text-sm text-destructive';
  }
  if (tone === 'desktop-error') {
    return 'text-sm text-red-500';
  }
  return '';
}

function contentStyle(tone: MarketplaceRouteStateTone) {
  if (tone === 'desktop-muted') return { color: 'var(--muted)' };
  if (tone === 'desktop-error') return undefined;
  return undefined;
}

export function MarketplaceRouteState({
  currentSlug,
  children,
  tone = 'web-muted',
}: {
  currentSlug: string;
  children: ReactNode;
  tone?: MarketplaceRouteStateTone;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <MarketplaceTopNav currentSlug={currentSlug} />
      <div
        className={cn(
          'flex flex-1 items-center justify-center',
          contentClassName(tone),
          tone === 'web-muted' && 'text-muted-foreground',
        )}
        style={contentStyle(tone)}
      >
        {children}
      </div>
    </div>
  );
}
