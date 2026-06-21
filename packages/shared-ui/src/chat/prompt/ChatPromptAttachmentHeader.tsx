'use client';

import { FileText, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PromptInputHeader } from '../../ai-elements/prompt-input';
import { Button } from '../../ui/button';
import type { LocalChatAttachment } from '../chat-attachments';
import type { ChatPromptSourceImage, PromptAction } from './types';

interface ChatPromptAttachmentHeaderProps {
  selectedSourceImages: ChatPromptSourceImage[];
  attachments: LocalChatAttachment[];
  imageWorkflowActive: boolean;
  selectedAction: PromptAction;
  onRemoveSourceImage?: (index: number) => void;
  onClearSourceImages?: () => void;
  onRemoveAttachment: (index: number) => void;
}

export function ChatPromptAttachmentHeader({
  selectedSourceImages,
  attachments,
  imageWorkflowActive,
  selectedAction,
  onRemoveSourceImage,
  onClearSourceImages,
  onRemoveAttachment,
}: ChatPromptAttachmentHeaderProps) {
  const t = useTranslations('chat');

  if (selectedSourceImages.length === 0 && attachments.length === 0) return null;

  return (
    <PromptInputHeader className="flex flex-col gap-2 px-4 pt-3">
      {selectedSourceImages.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto border-b border-border pb-3">
          <span className="shrink-0 text-xs text-muted-foreground">
            {t('imageWorkflow.editingFrom', { count: selectedSourceImages.length })}
          </span>
          {selectedSourceImages.map((image, index) => (
            <div
              key={`${image.url}-${index}`}
              className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border"
            >
              <img src={image.url} alt="" className="h-full w-full object-cover" />
              <Button
                type="button"
                variant="secondary"
                size="icon-xs"
                className="absolute right-0.5 top-0.5 rounded-full bg-background/80 backdrop-blur"
                aria-label={t('imageWorkflow.removeSource')}
                onClick={() => onRemoveSourceImage?.(index)}
              >
                <X />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="ml-auto text-muted-foreground"
            onClick={onClearSourceImages}
          >
            {t('imageWorkflow.clear')}
          </Button>
        </div>
      )}
      {selectedSourceImages.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t('imageWorkflow.editModeHint')}
        </p>
      )}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {imageWorkflowActive && selectedAction === 'image' && (
            <span className="flex w-full text-xs text-muted-foreground">{t('imageWorkflow.referenceImage')}</span>
          )}
          {attachments.map((attachment, i) => {
            const isVideo = attachment.kind === 'video';
            const isImage = attachment.kind === 'image';
            return (
              <div
                key={attachment.id}
                className="group relative min-h-16 min-w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/30"
              >
                {isVideo ? (
                  <video
                    src={attachment.url}
                    muted
                    className="h-16 w-16 object-cover"
                  />
                ) : isImage ? (
                  <img
                    src={attachment.url}
                    alt={attachment.name}
                    className="h-16 w-16 object-cover"
                  />
                ) : (
                  <div className="flex h-16 max-w-44 items-center gap-2 px-3 text-xs text-foreground">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{attachment.name}</span>
                  </div>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-xs"
                  className="absolute right-0.5 top-0.5 rounded-full bg-background/80 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100"
                  aria-label={t('attachments.remove')}
                  onClick={() => onRemoveAttachment(i)}
                >
                  <X />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </PromptInputHeader>
  );
}
