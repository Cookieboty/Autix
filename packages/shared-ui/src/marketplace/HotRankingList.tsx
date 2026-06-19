'use client';

import { TrendingUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AnyResource } from '@autix/shared-store';
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
  const t = useTranslations('marketplace.hotRanking');
  return (
    <div className="rounded-lg border border-white/12 bg-white/[0.075] p-4 text-white shadow-xl backdrop-blur-xl">
      <div className="mb-3 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-sky-300" />
        <span className="text-sm font-medium text-white">{t('title')}</span>
      </div>
      <ol className="space-y-2">
        {items.map((it, idx) => {
          const t = (it as unknown as { resourceType: keyof typeof TYPE_TO_SLUG })
            .resourceType;
          const slug = TYPE_TO_SLUG[t];
          return (
            <li
              key={`${t}-${it.id}`}
              className="flex cursor-pointer items-center gap-3 rounded-md p-1.5 transition-colors hover:bg-white/10"
              onClick={() => nav.push(`/marketplace/${slug}/${it.id}`)}
            >
              <span
                className={
                  'w-5 text-center text-xs font-semibold ' +
                  (idx < 3 ? 'text-sky-300' : 'text-white/42')
                }
              >
                {idx + 1}
              </span>
              <span className="flex-1 truncate text-sm text-white/86">
                {it.title}
              </span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/50">
                {it.useCount}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
