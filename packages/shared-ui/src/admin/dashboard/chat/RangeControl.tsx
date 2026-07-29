'use client';

import { useTranslations } from 'next-intl';
import type { ChatDashboardPresetWindow } from '@autix/domain/admin/chat-dashboard';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import type { ChatDashboardRangeState, ChatDashboardValidation } from './chat-dashboard.types';

export function RangeControl({
  range,
  validation,
  onPreset,
  onCustom,
}: {
  range: ChatDashboardRangeState;
  validation: ChatDashboardValidation;
  onPreset: (window: ChatDashboardPresetWindow) => void;
  onCustom: (from: string, to: string) => void;
}) {
  const t = useTranslations('chatDashboard.range');
  const options: Array<ChatDashboardRangeState['window']> = ['today', 'yesterday', 'last7d', 'custom'];
  const customRangeInvalid =
    range.window === 'custom' &&
    !validation.ok &&
    validation.reason === 'invalidRange';
  const validationMessageId = 'chat-dashboard-range-error';
  return (
    <div className="border-border bg-card rounded-xl border p-4">
      <div className="flex flex-wrap items-center gap-2">
        {options.map((option) => (
          <Button
            key={option}
            type="button"
            size="sm"
            variant={range.window === option ? 'default' : 'outline'}
            onClick={() => option === 'custom' ? onCustom(range.from ?? '', range.to ?? '') : onPreset(option)}
          >
            {t(option)}
          </Button>
        ))}
        {range.window === 'custom' ? (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Input
              aria-label={t('from')}
              aria-describedby={customRangeInvalid ? validationMessageId : undefined}
              aria-invalid={customRangeInvalid || undefined}
              type="date"
              value={range.from ?? ''}
              onChange={(event) => onCustom(event.target.value, range.to ?? '')}
              className="w-auto"
            />
            <span className="text-muted-foreground text-sm">—</span>
            <Input
              aria-label={t('to')}
              aria-describedby={customRangeInvalid ? validationMessageId : undefined}
              aria-invalid={customRangeInvalid || undefined}
              type="date"
              value={range.to ?? ''}
              onChange={(event) => onCustom(range.from ?? '', event.target.value)}
              className="w-auto"
            />
          </div>
        ) : null}
      </div>
      {!validation.ok ? (
        <p
          id={validationMessageId}
          role="alert"
          className="text-destructive mt-3 text-sm"
        >
          {t(validation.reason)}
        </p>
      ) : null}
    </div>
  );
}
