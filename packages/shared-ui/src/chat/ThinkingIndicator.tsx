'use client';

import { useTranslations } from 'next-intl';
import { Message, MessageContent } from '../ai-elements/message';
import { Loader } from '../ai-elements/loader';

interface ThinkingIndicatorProps {
  message?: string;
  progress?: {
    stepKey: string;
    displayName: string;
    index: number;
    total: number;
  } | null;
}

export function ThinkingIndicator({ message, progress }: ThinkingIndicatorProps) {
  const t = useTranslations('chat');
  const displayMessage = message ?? t('thinkingDefault');
  const percentage = progress ? (progress.index / progress.total) * 100 : 0;

  return (
    <Message from="assistant">
      <MessageContent className="w-full max-w-[720px] gap-4 rounded-lg bg-secondary px-5 py-4 border border-border">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-card">
            <Loader />
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-foreground">
              {progress ? progress.displayName : displayMessage}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {progress
                ? t('thinkingProgress', { step: progress.index, totalSteps: progress.total })
                : t('thinkingPreparing')}
            </div>
          </div>

          {progress && (
            <div className="rounded-sm px-1.5 py-0.5 text-[10.5px] font-medium tabular-nums bg-card text-muted-foreground border border-border">
              {Math.round(percentage)}%
            </div>
          )}
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full rounded-full bg-foreground transition-all duration-500"
            style={{ width: progress ? `${percentage}%` : '28%' }}
          />
        </div>
      </MessageContent>
    </Message>
  );
}
