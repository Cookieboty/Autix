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
    <div
      className="rounded-lg p-4"
      style={{
        backgroundColor: 'var(--panel)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4" style={{ color: 'var(--accent)' }} />
        <span className="font-medium text-sm">平台数据</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {rows.map((r) => (
          <div
            key={r.label}
            className="px-2 py-2 rounded"
            style={{ backgroundColor: 'var(--panel-muted)' }}
          >
            <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
              {r.label}
            </div>
            <div
              className="text-base font-semibold"
              style={{ color: 'var(--foreground)' }}
            >
              {r.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
