'use client';

import { FileText, ImagePlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '../../ui/utils';
import type { PromptAction } from './types';

interface ChatPromptActionMenuProps {
  open: boolean;
  imageWorkflowActive: boolean;
  selectedAction: PromptAction;
  isEditMode: boolean;
  onUploadFile: () => void;
  onSelectAction: (action: PromptAction) => void;
  onClose: () => void;
}

export function ChatPromptActionMenu({
  open,
  imageWorkflowActive,
  selectedAction,
  isEditMode,
  onUploadFile,
  onSelectAction,
  onClose,
}: ChatPromptActionMenuProps) {
  const t = useTranslations('chat');

  if (!open) return null;

  return (
    <div className="absolute bottom-12 left-3 z-50 mb-2 w-48 overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-md">
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
        onClick={() => {
          onUploadFile();
          onClose();
        }}
      >
        <FileText className="size-4" />
        {t('attachments.uploadFile')}
      </button>
      {imageWorkflowActive && (
        <button
          type="button"
          className={cn(
            'flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm transition-colors',
            selectedAction === 'image'
              ? 'bg-muted text-primary'
              : 'text-foreground hover:bg-muted',
          )}
          onClick={() => {
            onSelectAction('image');
            onClose();
          }}
        >
          <span className="flex items-center gap-2">
            <ImagePlus className="size-4" />
            {isEditMode ? t('imageWorkflow.editImage') : t('imageWorkflow.createImage')}
          </span>
          {selectedAction === 'image' && <span>✓</span>}
        </button>
      )}
    </div>
  );
}
