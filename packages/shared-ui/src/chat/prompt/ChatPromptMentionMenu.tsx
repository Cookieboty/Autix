'use client';

import { AtSign } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AcquiredItem } from './types';

interface ChatPromptMentionMenuProps {
  open: boolean;
  mentions: AcquiredItem[];
  onSelect: (item: AcquiredItem) => void;
}

export function ChatPromptMentionMenu({
  open,
  mentions,
  onSelect,
}: ChatPromptMentionMenuProps) {
  const t = useTranslations('chat');

  if (!open) return null;

  return (
    <div className="absolute bottom-full left-0 z-50 mb-2 w-72 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-md">
      <div className="flex items-center gap-1 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <AtSign className="size-3" /> {t('mentions.title')}
      </div>
      {mentions.length === 0 ? (
        <div className="px-3 py-2 text-xs text-muted-foreground">
          {t('mentions.empty')}
        </div>
      ) : (
        mentions.map((it) => (
          <button
            key={`${it.resourceType}-${it.resourceId}`}
            onClick={() => onSelect(it)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
          >
            <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
              {it.resourceType}
            </span>
            <span className="flex-1 truncate">{it.resource?.title ?? it.resourceId}</span>
          </button>
        ))
      )}
    </div>
  );
}
