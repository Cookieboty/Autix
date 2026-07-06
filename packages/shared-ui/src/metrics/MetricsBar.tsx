'use client';

import type { ReactNode } from 'react';
import { Bookmark, Eye, Heart, Quote, Share2, Users } from 'lucide-react';
import { useResourceMetrics, type ResourceType } from '@autix/shared-store';
import { formatMetricCount } from './format';

export interface MetricsBarProps {
  type: ResourceType;
  id: string;
}

interface MetricItem {
  key: string;
  icon: ReactNode;
  label: string;
  value: number;
}

/**
 * 资源统一指标条：PV / UV / 点赞 / 收藏 / 引用 / 分享。
 * 内部通过 useResourceMetrics 拉取数据 —— 尚无 resource_metrics 行时后端返回全零快照，
 * 因此加载中/无数据都按 0 渲染，不需要额外的空态处理。
 */
export function MetricsBar({ type, id }: MetricsBarProps) {
  const { data } = useResourceMetrics(type, id);

  const items: MetricItem[] = [
    { key: 'pv', icon: <Eye className="w-4 h-4" />, label: 'PV', value: data?.pvCount ?? 0 },
    { key: 'uv', icon: <Users className="w-4 h-4" />, label: 'UV', value: data?.uvCount ?? 0 },
    {
      key: 'like',
      icon: <Heart className="w-4 h-4" />,
      label: '点赞',
      value: data?.likeCount ?? 0,
    },
    {
      key: 'favorite',
      icon: <Bookmark className="w-4 h-4" />,
      label: '收藏',
      value: data?.favoriteCount ?? 0,
    },
    {
      key: 'reference',
      icon: <Quote className="w-4 h-4" />,
      label: '引用',
      value: data?.referenceCount ?? 0,
    },
    {
      key: 'share',
      icon: <Share2 className="w-4 h-4" />,
      label: '分享',
      value: data?.shareCount ?? 0,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-4 text-xs" style={{ color: 'var(--muted)' }}>
      {items.map((item) => (
        <div key={item.key} className="flex items-center gap-1.5" title={item.label}>
          <span style={{ color: 'var(--muted)' }}>{item.icon}</span>
          <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            {formatMetricCount(item.value)}
          </span>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
