'use client';

import { TrendingUp } from 'lucide-react';
import type { AnyResource } from '@autix/shared-lib';
import { useRouter } from '../navigation';

const TYPE_TO_SLUG = {
  IMAGE_TEMPLATE: 'image-templates',
  VIDEO_TEMPLATE: 'video-templates',
  SKILL: 'skills',
  MCP: 'mcp',
  AGENT: 'agents',
} as const;

export function HotRankingList({ items }: { items: AnyResource[] }) {
  const nav = useRouter();
  return (
    <div
      className="rounded-lg p-4"
      style={{
        backgroundColor: 'var(--panel)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp
          className="w-4 h-4"
          style={{ color: 'var(--accent)' }}
        />
        <span className="font-medium text-sm">热门排行榜</span>
      </div>
      <ol className="space-y-2">
        {items.map((it, idx) => {
          const t = (it as unknown as { resourceType: keyof typeof TYPE_TO_SLUG })
            .resourceType;
          const slug = TYPE_TO_SLUG[t];
          return (
            <li
              key={`${t}-${it.id}`}
              className="flex items-center gap-3 cursor-pointer hover:bg-[var(--panel-muted)] rounded p-1"
              onClick={() => nav.push(`/marketplace/${slug}/${it.id}`)}
            >
              <span
                className="w-5 text-center text-xs font-semibold"
                style={{
                  color:
                    idx < 3 ? 'var(--accent)' : 'var(--muted)',
                }}
              >
                {idx + 1}
              </span>
              <span
                className="flex-1 truncate text-sm"
                style={{ color: 'var(--foreground)' }}
              >
                {it.title}
              </span>
              <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
                {it.useCount}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
