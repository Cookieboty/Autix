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
    <div
      className="rounded-lg p-4"
      style={{
        backgroundColor: 'var(--panel)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Award className="w-4 h-4" style={{ color: 'var(--accent)' }} />
        <span className="font-medium text-sm">编辑精选</span>
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
              className="flex items-center gap-3 cursor-pointer hover:bg-[var(--panel-muted)] rounded p-1"
              onClick={() => nav.push(`/marketplace/${slug}/${it.id}`)}
            >
              <div
                className="w-12 h-12 rounded overflow-hidden flex-shrink-0"
                style={{ backgroundColor: 'var(--panel-muted)' }}
              >
                <FallbackImage
                  src={(it as { coverImage?: string }).coverImage}
                  alt={it.title}
                  className="w-full h-full object-cover"
                  fallbackText=""
                />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm truncate"
                  style={{ color: 'var(--foreground)' }}
                >
                  {it.title}
                </p>
                <p
                  className="text-[11px] truncate"
                  style={{ color: 'var(--muted)' }}
                >
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
