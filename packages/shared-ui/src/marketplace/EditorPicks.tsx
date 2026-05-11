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
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Award className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-foreground">编辑精选</span>
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
              className="flex cursor-pointer items-center gap-3 rounded p-1 hover:bg-muted"
              onClick={() => nav.push(`/marketplace/${slug}/${it.id}`)}
            >
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-muted">
                <FallbackImage
                  src={(it as { coverImage?: string }).coverImage}
                  alt={it.title}
                  className="h-full w-full object-cover"
                  fallbackText=""
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">{it.title}</p>
                <p className="truncate text-[11px] text-muted-foreground">
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
