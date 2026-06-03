'use client';

import { Award } from 'lucide-react';
import type { AnyResource } from '@autix/shared-lib';
import { useRouter } from '../navigation';
import { FallbackImage } from '../template/FallbackImage';

const TYPE_TO_SLUG = {
  IMAGE_TEMPLATE: 'image-templates',
  VIDEO_TEMPLATE: 'video-templates',
  SKILL: 'skills',
  MCP: 'mcp',
  AGENT: 'agents',
} as const;

export function EditorPicks({ items }: { items: AnyResource[] }) {
  const nav = useRouter();
  return (
    <div className="rounded-lg border border-white/12 bg-white/[0.075] p-4 text-white shadow-xl backdrop-blur-xl">
      <div className="mb-3 flex items-center gap-2">
        <Award className="h-4 w-4 text-amber-300" />
        <span className="text-sm font-medium text-white">编辑精选</span>
      </div>
      <ul className="space-y-3">
        {items.map((it) => {
          const t = (
            it as unknown as { resourceType: keyof typeof TYPE_TO_SLUG }
          ).resourceType;
          const slug = TYPE_TO_SLUG[t];
          return (
            <li
              key={`${t}-${it.id}`}
              className="flex cursor-pointer items-center gap-3 rounded-md p-1.5 transition-colors hover:bg-white/10"
              onClick={() => nav.push(`/marketplace/${slug}/${it.id}`)}
            >
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-black/30">
                <FallbackImage
                  src={(it as { coverImage?: string }).coverImage}
                  alt={it.title}
                  className="h-full w-full object-cover"
                  fallbackText=""
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-white/88">{it.title}</p>
                <p className="truncate text-[11px] text-white/46">
                  {(it as { description?: string }).description ?? '—'}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
