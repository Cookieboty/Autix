'use client';

import React from 'react';
import { Card, Button, Chip, Badge } from '@heroui/react';
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
        <Card.Header className="flex gap-3">
          <CheckCircle2 className="w-5 h-5 text-success" />
          <div className="flex flex-col gap-1 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold">{title}</p>
              <Badge color="success" variant="soft">
                {confirmedAction === 'submit' ? t('confirmed') : t('cancelled')}
              </Badge>
            </div>
          </div>
        </Card.Header>
        
        <Card.Content className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">{t('summary')}</p>
            <p className="text-sm text-default-500 whitespace-pre-wrap">{summary}</p>
          </div>
          
          {impact && (
            <div className="flex items-start gap-3 p-4 bg-warning-50 dark:bg-warning-900/20 rounded-lg border border-warning-200 dark:border-warning-800">
              <AlertCircle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium mb-1.5">{t('impactAssessment')}</p>
                <p className="text-sm text-default-600 whitespace-pre-wrap">{impact}</p>
              </div>
            </div>
          )}
        </Card.Content>
      </Card>
    );
  }
  
  return (
    <Card className="max-w-2xl">
      <Card.Header className="flex gap-3">
        <CheckCircle2 className="w-5 h-5 text-success" />
        <div className="flex flex-col">
          <p className="text-base font-semibold">{title}</p>
        </div>
      </Card.Header>
      
      <Card.Content className="space-y-4">
        <div>
          <p className="text-sm font-medium mb-2">{t('summary')}</p>
          <p className="text-sm text-default-500 whitespace-pre-wrap">{summary}</p>
        </div>
        
        {impact && (
          <div className="flex items-start gap-3 p-4 bg-warning-50 dark:bg-warning-900/20 rounded-lg border border-warning-200 dark:border-warning-800">
            <AlertCircle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium mb-1.5">{t('impactAssessment')}</p>
              <p className="text-sm text-default-600 whitespace-pre-wrap">{impact}</p>
            </div>
          </div>
        )}
      </Card.Content>
      
      <Card.Footer className="justify-end gap-2">
        <Button
          variant="ghost"
          onPress={() => onAction('cancel', {})}
          isDisabled={disabled}
        >
          {resolvedCancelLabel}
        </Button>
        <Button
          variant="primary"
          onPress={() => onAction('submit', {})}
          isDisabled={disabled}
        >
          {resolvedConfirmLabel}
        </Button>
      </Card.Footer>
    </Card>
  );
}
