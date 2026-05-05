'use client';

import React from 'react';
import { Card, CardHeader, CardContent, CardFooter } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { UIConfirmation, UIActionCallback } from '@autix/shared-lib';

interface ConfirmDialogProps extends UIConfirmation, UIActionCallback {
  confirmedAction?: string;
}

export function ConfirmDialog({
  title,
  summary,
  impact,
  confirmLabel,
  cancelLabel,
  onAction,
  disabled,
  confirmedAction,
}: ConfirmDialogProps) {
  const t = useTranslations('aiUi');
  const resolvedConfirmLabel = confirmLabel || t('confirm');
  const resolvedCancelLabel = cancelLabel || t('cancel');

  if (disabled && confirmedAction) {
    return (
      <Card className="max-w-2xl">
        <CardHeader className="flex gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-500" />
          <div className="flex flex-col gap-1 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold">{title}</p>
              <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
                {confirmedAction === 'submit' ? t('confirmed') : t('cancelled')}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">{t('summary')}</p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{summary}</p>
          </div>

          {impact && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium mb-1.5">{t('impactAssessment')}</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{impact}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader className="flex gap-3">
        <CheckCircle2 className="w-5 h-5 text-green-500" />
        <div className="flex flex-col">
          <p className="text-base font-semibold">{title}</p>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium mb-2">{t('summary')}</p>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{summary}</p>
        </div>

        {impact && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium mb-1.5">{t('impactAssessment')}</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{impact}</p>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="justify-end gap-2">
        <Button
          variant="ghost"
          onClick={() => onAction('cancel', {})}
          disabled={disabled}
        >
          {resolvedCancelLabel}
        </Button>
        <Button
          onClick={() => onAction('submit', {})}
          disabled={disabled}
        >
          {resolvedConfirmLabel}
        </Button>
      </CardFooter>
    </Card>
  );
}
