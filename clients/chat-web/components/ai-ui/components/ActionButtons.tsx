import React, { useState } from 'react';
import { Button, Modal, ModalBackdrop, ModalDialog, ModalHeader, ModalHeading, ModalBody, ModalFooter } from '@heroui/react';
import { UIActionButtons, UIActionCallback, ActionButton as ActionButtonType } from '@/types/ai-ui';

interface ActionButtonsProps extends UIActionButtons, UIActionCallback {}

export function ActionButtons({
  layout = 'horizontal',
  buttons,
  onAction,
  disabled,
}: ActionButtonsProps) {
  const [confirmAction, setConfirmAction] = useState<ActionButtonType | null>(null);
  
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
      
      <Modal isOpen={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <ModalBackdrop>
          <ModalDialog className="max-w-md">
            <ModalHeader>
              <ModalHeading>确认操作</ModalHeading>
            </ModalHeader>
            <ModalBody>
              <p className="text-sm text-default-500">
                {confirmAction?.confirm?.message || '确定要执行此操作吗?'}
              </p>
            </ModalBody>
            <ModalFooter>
              <Button
                variant="ghost"
                onPress={() => setConfirmAction(null)}
              >
                取消
              </Button>
              <Button
                variant="primary"
                onPress={handleConfirm}
              >
                确认
              </Button>
            </ModalFooter>
          </ModalDialog>
        </ModalBackdrop>
      </Modal>
    </>
  );
}
