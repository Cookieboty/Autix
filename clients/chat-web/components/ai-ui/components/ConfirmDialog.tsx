import React from 'react';
import { Card, Button, Chip } from '@heroui/react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { UIConfirmation, UIActionCallback } from '@/types/ai-ui';

interface ConfirmDialogProps extends UIConfirmation, UIActionCallback {}

export function ConfirmDialog({
  title,
  summary,
  impact,
  confirmLabel = '确认',
  cancelLabel = '取消',
  onAction,
  disabled,
}: ConfirmDialogProps) {
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
          <p className="text-sm font-medium mb-2">操作摘要</p>
          <p className="text-sm text-default-500 whitespace-pre-wrap">{summary}</p>
        </div>
        
        {impact && (
          <div className="flex items-start gap-3 p-4 bg-warning-50 dark:bg-warning-900/20 rounded-lg border border-warning-200 dark:border-warning-800">
            <AlertCircle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium mb-1.5">影响评估</p>
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
          {cancelLabel}
        </Button>
        <Button
          variant="primary"
          onPress={() => onAction('submit', {})}
          isDisabled={disabled}
        >
          {confirmLabel}
        </Button>
      </Card.Footer>
    </Card>
  );
}
