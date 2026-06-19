'use client';

import { Monitor, Globe, Boxes } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { RuntimeReq } from '@autix/shared-lib';

const META: Record<
  RuntimeReq,
  { labelKey: 'cloud' | 'desktopOnly' | 'either'; color: string; icon: React.ReactNode; descKey: 'cloudDesc' | 'desktopOnlyDesc' | 'eitherDesc' }
> = {
  CLOUD: {
    labelKey: 'cloud',
    color: '#22c55e',
    icon: <Globe className="w-3 h-3" />,
    descKey: 'cloudDesc',
  },
  DESKTOP_ONLY: {
    labelKey: 'desktopOnly',
    color: '#7c3aed',
    icon: <Monitor className="w-3 h-3" />,
    descKey: 'desktopOnlyDesc',
  },
  EITHER: {
    labelKey: 'either',
    color: '#0ea5e9',
    icon: <Boxes className="w-3 h-3" />,
    descKey: 'eitherDesc',
  },
};

export function RuntimeBadge({
  level,
  reason,
  showReason = false,
}: {
  level: RuntimeReq;
  reason?: string | null;
  showReason?: boolean;
}) {
  const m = META[level];
  const t = useTranslations('marketplace.runtime');
  return (
    <div className="inline-flex flex-col gap-1">
      <span
        className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
        style={{ backgroundColor: m.color, color: '#fff' }}
        title={t(m.descKey)}
      >
        {m.icon}
        {t(m.labelKey)}
      </span>
      {showReason && reason && (
        <span className="text-[11px] text-muted-foreground">{reason}</span>
      )}
    </div>
  );
}
