'use client';

import { BarChart3 } from 'lucide-react';
import type { PlatformStats as PlatformStatsData } from '@autix/shared-lib';

export function PlatformStats({ stats }: { stats: PlatformStatsData | null }) {
  if (!stats) return null;
  const rows: { label: string; value: number }[] = [
    { label: '资源总数', value: stats.totalResources },
    { label: '图片模板', value: stats.byImageTemplateCount },
    { label: '视频模板', value: stats.byVideoTemplateCount },
    { label: '累计获取', value: stats.totalAcquisitions },
  ];
  return (
    <div className="rounded-lg border border-white/12 bg-white/[0.075] p-4 text-white shadow-xl backdrop-blur-xl">
      <div className="mb-3 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-emerald-300" />
        <span className="text-sm font-medium text-white">平台数据</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {rows.map((r) => (
          <div key={r.label} className="rounded-md border border-white/10 bg-white/10 px-2 py-2">
            <div className="text-[11px] text-white/46">{r.label}</div>
            <div className="text-base font-semibold text-white">{r.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
