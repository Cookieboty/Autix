'use client';

import React, { useState } from 'react';
import { Button, ModalBackdrop, ModalDialog, ModalHeader, ModalHeading, ModalBody, ModalFooter, Badge } from '@heroui/react';
import { useTranslations } from 'next-intl';
import { UIActionButtons, UIActionCallback, ActionButton as ActionButtonType } from '@autix/shared-lib';

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
      <div className="flex items-center gap-3 p-4 bg-default-100 rounded-lg border border-default-200">
        <Badge color="success" variant="soft">{t('executed')}</Badge>
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
  
  const getButtonVariant = (variant?: string | null): any => {
    switch (variant) {
      case 'primary':
        return 'primary';
      case 'danger':
        return 'danger';
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
            onPress={() => handleButtonClick(button)}
            isDisabled={disabled || !!button.disabled}
          >
            {button.label}
          </Button>
        ))}
      </div>
      
      <ModalBackdrop isOpen={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <ModalDialog className="max-w-md">
            <ModalHeader>
              <ModalHeading>{t('confirmAction')}</ModalHeading>
            </ModalHeader>
            <ModalBody>
              <p className="text-sm text-default-500">
                {confirmAction?.confirm?.message || t('confirmActionDefault')}
              </p>
            </ModalBody>
            <ModalFooter>
              <Button
                variant="ghost"
                onPress={() => setConfirmAction(null)}
              >
                {t('cancel')}
              </Button>
              <Button
                variant="primary"
                onPress={handleConfirm}
              >
                {t('confirm')}
              </Button>
            </ModalFooter>
        </ModalDialog>
      </ModalBackdrop>
    </>
  );
}
