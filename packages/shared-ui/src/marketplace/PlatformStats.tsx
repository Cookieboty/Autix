'use client';

import { BarChart3 } from 'lucide-react';
import type { PlatformStats as PlatformStatsData } from '@autix/shared-lib';

export function PlatformStats({ stats }: { stats: PlatformStatsData | null }) {
  if (!stats) return null;
  const rows: { label: string; value: number }[] = [
    { label: '资源总数', value: stats.totalResources },
    { label: 'Skills', value: stats.bySkillCount },
    { label: 'MCP', value: stats.byMcpCount },
    { label: 'Agents', value: stats.byAgentCount },
    { label: '图片模板', value: stats.byImageTemplateCount },
    { label: '视频模板', value: stats.byVideoTemplateCount },
    { label: '累计获取', value: stats.totalAcquisitions },
  ];
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-foreground">平台数据</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {rows.map((r) => (
          <div key={r.label} className="rounded bg-muted px-2 py-2">
            <div className="text-[11px] text-muted-foreground">{r.label}</div>
            <div className="text-base font-semibold text-foreground">{r.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
