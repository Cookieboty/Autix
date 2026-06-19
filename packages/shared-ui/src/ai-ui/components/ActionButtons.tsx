'use client';

import React, { useState } from 'react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '../../ui/dialog';
import { useTranslations } from 'next-intl';
import type {
  ActionButton as ActionButtonType,
  UIActionButtons,
  UIActionCallback,
} from '@autix/shared-store';

interface ActionButtonsProps extends UIActionButtons, UIActionCallback {
  executedAction?: string;
}

export function ActionButtons({
  layout = 'horizontal',
  buttons,
  onAction,
  disabled,
  executedAction,
}: ActionButtonsProps) {
  const t = useTranslations('aiUi');
  const [confirmAction, setConfirmAction] = useState<ActionButtonType | null>(null);

  if (disabled && executedAction) {
    const executedButton = buttons.find(b => b.action === executedAction);
    return (
      <div className="flex items-center gap-3 p-4 bg-muted rounded-lg border border-border">
        <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">{t('executed')}</Badge>
        <span className="text-sm">
          {t('actionExecuted', { action: executedButton?.label || executedAction })}
        </span>
      </div>
    );
  }

  const handleButtonClick = (button: ActionButtonType) => {
    if (button.confirm) {
      setConfirmAction(button);
    } else {
      onAction(button.action, {});
    }
  };

  const handleConfirm = () => {
    if (confirmAction) {
      onAction(confirmAction.action, {});
      setConfirmAction(null);
    }
  };

  const getButtonVariant = (variant?: string | null): "default" | "destructive" | "secondary" | "ghost" | "outline" => {
    switch (variant) {
      case 'primary':
        return 'default';
      case 'danger':
        return 'destructive';
      case 'secondary':
        return 'secondary';
      case 'ghost':
        return 'ghost';
      default:
        return 'secondary';
    }
  };

  return (
    <>
      <div className={`flex gap-2 ${layout === 'vertical' ? 'flex-col' : 'flex-row flex-wrap'}`}>
        {buttons.map((button, index) => (
          <Button
            key={index}
            variant={getButtonVariant(button.variant)}
            onClick={() => handleButtonClick(button)}
            disabled={disabled || !!button.disabled}
          >
            {button.label}
          </Button>
        ))}
      </div>

      <Dialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('confirmAction')}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-muted-foreground">
              {confirmAction?.confirm?.message || t('confirmActionDefault')}
            </p>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmAction(null)}
            >
              {t('cancel')}
            </Button>
            <Button
              onClick={handleConfirm}
            >
              {t('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
