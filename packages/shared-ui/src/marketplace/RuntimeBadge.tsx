'use client';

import { Monitor, Globe, Boxes } from 'lucide-react';
import type { RuntimeReq } from '@autix/shared-lib';

const META: Record<
  RuntimeReq,
  { label: string; color: string; icon: React.ReactNode; desc: string }
> = {
  CLOUD: {
    label: '云端可用',
    color: '#22c55e',
    icon: <Globe className="w-3 h-3" />,
    desc: '云端运行,Web 与桌面端均可使用',
  },
  DESKTOP_ONLY: {
    label: '仅桌面端',
    color: '#7c3aed',
    icon: <Monitor className="w-3 h-3" />,
    desc: '需要本地运行环境(进程/文件/CLI)',
  },
  EITHER: {
    label: '通用',
    color: '#0ea5e9',
    icon: <Boxes className="w-3 h-3" />,
    desc: '可在云端或桌面端选择性使用',
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
  return (
    <div className="inline-flex flex-col gap-1">
      <span
        className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
        style={{ backgroundColor: m.color, color: '#fff' }}
        title={m.desc}
      >
        {m.icon}
        {m.label}
      </span>
      {showReason && reason && (
        <span className="text-[11px] text-muted-foreground">{reason}</span>
      )}
    </div>
  );
}
