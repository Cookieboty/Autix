'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PromptInputHeader } from '../../ai-elements/prompt-input';
import type { ChatPromptActiveTemplate } from './types';

interface ChatPromptTemplateHeaderProps {
  activeTemplate: ChatPromptActiveTemplate;
  onOpenTemplateEditor?: () => void;
  onReuseTemplate?: () => void;
  onRemoveTemplate?: () => void;
}

export function ChatPromptTemplateHeader({
  activeTemplate,
  onOpenTemplateEditor,
  onReuseTemplate,
  onRemoveTemplate,
}: ChatPromptTemplateHeaderProps) {
  const t = useTranslations('chat');

  return (
    <PromptInputHeader className="flex items-center gap-2 border-b border-border px-4 py-2">
      {activeTemplate.coverImage && (
        <img
          src={activeTemplate.coverImage}
          alt=""
          className="size-8 shrink-0 rounded-md object-cover"
        />
      )}
      <div className="min-w-0 flex-1">
        <span className="truncate text-sm font-medium text-foreground">
          {activeTemplate.title}
        </span>
        {activeTemplate.variableCount > 0 && (
          <span className="ml-2 text-xs text-muted-foreground">
            {t('template.variableCount', { count: activeTemplate.variableCount })}
          </span>
        )}
      </div>
      {onReuseTemplate && (
        <button
          type="button"
          onClick={onReuseTemplate}
          className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
        >
          {t('template.reusePrompt')}
        </button>
      )}
      {onOpenTemplateEditor && (activeTemplate.editable ?? activeTemplate.variableCount > 0) && (
        <button
          type="button"
          onClick={onOpenTemplateEditor}
          className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
        >
          {t('template.edit')}
        </button>
      )}
      <button
        type="button"
        onClick={onRemoveTemplate}
        className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
        aria-label={t('template.removeTemplate')}
      >
        <X className="size-3.5" />
      </button>
    </PromptInputHeader>
  );
}
