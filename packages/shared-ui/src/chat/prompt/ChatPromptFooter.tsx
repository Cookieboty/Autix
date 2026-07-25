'use client';

import { Coins, ImagePlus, Loader2, Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { RefObject } from 'react';
import {
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTools,
} from '../../ai-elements/prompt-input';
import { cn } from '../../ui/utils';
import { CHAT_ATTACHMENT_ACCEPT } from '../chat-attachments';
import { MAX_ATTACHMENTS } from './useChatPromptAttachments';
import type { PromptAction } from './types';

interface ChatPromptFooterProps {
  actionMenuOpen: boolean;
  imageWorkflowActive: boolean;
  selectedAction: PromptAction;
  activeActionLabel: string;
  attachmentsCount: number;
  canSend: boolean;
  isStreaming: boolean;
  showEstimatedCost: boolean;
  estimatedCost?: number | null;
  estimatingCost: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onToggleActionMenu: () => void;
  onSelectAction: (action: PromptAction) => void;
  onFilesSelected: (files: FileList) => void;
}

export function ChatPromptFooter({
  actionMenuOpen,
  imageWorkflowActive,
  selectedAction,
  activeActionLabel,
  attachmentsCount,
  canSend,
  isStreaming,
  showEstimatedCost,
  estimatedCost,
  estimatingCost,
  fileInputRef,
  onToggleActionMenu,
  onSelectAction,
  onFilesSelected,
}: ChatPromptFooterProps) {
  const t = useTranslations('chat');

  return (
    <PromptInputFooter>
      <PromptInputTools>
        <div className="relative">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            accept={CHAT_ATTACHMENT_ACCEPT}
            onChange={(event) => {
              if (event.target.files) onFilesSelected(event.target.files);
              event.target.value = '';
            }}
          />
          <PromptInputButton
            aria-label={t('openActions')}
            aria-expanded={actionMenuOpen}
            onClick={onToggleActionMenu}
          >
            <Plus className="size-4" />
          </PromptInputButton>
        </div>
        {imageWorkflowActive && selectedAction === 'image' && (
          <PromptInputButton
            variant="ghost"
            size="sm"
            className="text-primary"
            onClick={() => onSelectAction('chat')}
            aria-label={t('imageWorkflow.cancelGeneration')}
          >
            <ImagePlus />
            {activeActionLabel}
            <X className="size-3" />
          </PromptInputButton>
        )}
        {attachmentsCount > 0 && (
          <span className="ml-1 text-xs text-muted-foreground">
            {attachmentsCount}/{MAX_ATTACHMENTS}
          </span>
        )}
      </PromptInputTools>

      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">{t('sendShortcut')}</span>
        <PromptInputSubmit
          disabled={!canSend}
          status={isStreaming ? 'streaming' : 'ready'}
          aria-label={isStreaming ? t('generatingReply') : t('sendMessage')}
          size={showEstimatedCost ? 'sm' : 'icon-sm'}
          className={cn(showEstimatedCost && 'min-w-[84px] gap-1.5 rounded-full px-2.5')}
          title={
            estimatedCost != null
              ? t('points.estimatedCost', { cost: estimatedCost })
              : estimatingCost
                ? t('points.estimating')
                : undefined
          }
        >
          {showEstimatedCost ? (
            estimatingCost ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <>
                <Coins className="size-3.5" />
                <span className="text-xs">{t('points.cost', { cost: estimatedCost ?? 0 })}</span>
              </>
            )
          ) : undefined}
        </PromptInputSubmit>
      </div>
    </PromptInputFooter>
  );
}
