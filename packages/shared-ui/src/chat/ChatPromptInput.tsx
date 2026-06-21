'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { AgentKind } from '@autix/shared-store';
import {
  PromptInput,
  PromptInputBody,
  PromptInputHeader,
  PromptInputTextarea,
  type PromptInputMessage,
} from '../ai-elements/prompt-input';
import {
  shouldUseImageGeneration,
  type LocalChatAttachment,
} from './chat-attachments';
import { ChatPromptActionMenu } from './prompt/ChatPromptActionMenu';
import { ChatPromptAttachmentHeader } from './prompt/ChatPromptAttachmentHeader';
import { ChatPromptFooter } from './prompt/ChatPromptFooter';
import { ChatPromptMentionMenu } from './prompt/ChatPromptMentionMenu';
import { ChatPromptTemplateHeader } from './prompt/ChatPromptTemplateHeader';
import {
  createInjectedAttachments,
  useChatPromptAttachments,
} from './prompt/useChatPromptAttachments';
import { useChatPromptMentions } from './prompt/useChatPromptMentions';
import type {
  ChatPromptActiveTemplate,
  ChatPromptInjectValue,
  ChatPromptSourceImage,
  PromptAction,
} from './prompt/types';

interface ChatPromptInputProps {
  onSend: (content: string, attachments?: LocalChatAttachment[]) => void;
  isStreaming: boolean;
  inputKind?: AgentKind;
  resetToken?: number;
  enableImages?: boolean;
  enableVideo?: boolean;
  imageWorkflowActive?: boolean;
  selectedSourceImages?: ChatPromptSourceImage[];
  onGenerateImage?: (instruction?: string, attachments?: LocalChatAttachment[]) => void;
  onRemoveSourceImage?: (index: number) => void;
  onClearSourceImages?: () => void;
  activeTemplate?: ChatPromptActiveTemplate;
  onOpenTemplateEditor?: () => void;
  onReuseTemplate?: () => void;
  onRemoveTemplate?: () => void;
  injectValue?: ChatPromptInjectValue;
  glassEffect?: boolean;
  headerSlot?: ReactNode;
  onPasteFiles?: (files: File[]) => void;
  estimatedCost?: number | null;
  estimatingCost?: boolean;
}

export function ChatPromptInput({
  onSend,
  isStreaming,
  inputKind = 'chat',
  resetToken,
  enableImages = false,
  enableVideo = false,
  imageWorkflowActive = false,
  selectedSourceImages = [],
  onGenerateImage,
  onRemoveSourceImage,
  onClearSourceImages,
  activeTemplate,
  onOpenTemplateEditor,
  onReuseTemplate,
  onRemoveTemplate,
  injectValue,
  glassEffect,
  headerSlot,
  onPasteFiles,
  estimatedCost = null,
  estimatingCost = false,
}: ChatPromptInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = useTranslations('chat');
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<PromptAction>('chat');

  const {
    attachments,
    setAttachments,
    clearAttachments,
    addAttachmentsFromFiles,
    handlePaste,
    removeAttachment,
  } = useChatPromptAttachments({ enableVideo, onPasteFiles });
  const {
    mentionOpen,
    filteredMentions,
    handleInputChange,
    handleKeyDown,
    insertMention,
  } = useChatPromptMentions({ input, setInput, textareaRef });

  useEffect(() => {
    if (!imageWorkflowActive) setSelectedAction('chat');
  }, [imageWorkflowActive]);

  useEffect(() => {
    if (!injectValue) return;
    setInput(injectValue.content);
    setAttachments(createInjectedAttachments(injectValue));
    const rafId = requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    });
    return () => cancelAnimationFrame(rafId);
  }, [injectValue?.token]);

  useEffect(() => {
    if (resetToken == null) return;
    setInput('');
    clearAttachments();
    setSelectedAction('chat');
    setActionMenuOpen(false);
  }, [resetToken, clearAttachments]);

  const flushSend = () => {
    if (isStreaming) return;
    if (shouldUseImageGeneration({ mode: inputKind, action: selectedAction }) && onGenerateImage) {
      onGenerateImage(input.trim() || undefined, attachments.length > 0 ? attachments : undefined);
      setInput('');
      clearAttachments();
      setActionMenuOpen(false);
      return;
    }

    if (!input.trim() && attachments.length === 0) return;
    onSend(input.trim(), attachments.length > 0 ? attachments : undefined);
    setInput('');
    clearAttachments();
    setActionMenuOpen(false);
  };

  const handleSubmit = (_message: PromptInputMessage) => {
    flushSend();
  };

  const canSend =
    !isStreaming &&
    ((shouldUseImageGeneration({ mode: inputKind, action: selectedAction }) && !!onGenerateImage) ||
      !!input.trim() ||
      attachments.length > 0);
  const isEditMode = selectedSourceImages.length > 0;
  const hasImageAttachments = attachments.some((attachment) => attachment.kind === 'image');
  const activeActionLabel =
    imageWorkflowActive && selectedAction === 'image'
      ? isEditMode
        ? t('imageWorkflow.editImage')
        : hasImageAttachments
          ? t('imageWorkflow.referenceToImage')
          : t('imageWorkflow.createImage')
      : t('deepSearch');
  const showEstimatedCost = !isStreaming && (estimatingCost || estimatedCost != null);

  return (
    <div className="relative flex flex-col gap-2">
      <ChatPromptMentionMenu
        open={mentionOpen}
        mentions={filteredMentions}
        onSelect={insertMention}
      />
      <ChatPromptActionMenu
        open={actionMenuOpen}
        imageWorkflowActive={imageWorkflowActive}
        selectedAction={selectedAction}
        isEditMode={isEditMode}
        onUploadFile={() => fileInputRef.current?.click()}
        onSelectAction={setSelectedAction}
        onClose={() => setActionMenuOpen(false)}
      />

      <PromptInput
        onSubmit={handleSubmit}
        className={
          glassEffect
            ? '!border-transparent !bg-transparent !shadow-none focus-within:!border-transparent focus-within:!ring-0'
            : activeTemplate
              ? '!border-white/12 !bg-black/86 !shadow-[0_18px_70px_rgba(0,0,0,0.32)] focus-within:!border-white/22 focus-within:!ring-[3px] focus-within:!ring-white/10'
              : '!border-white/12 !bg-black/88 !shadow-[0_18px_70px_rgba(0,0,0,0.32)] focus-within:!border-white/22 focus-within:!ring-[3px] focus-within:!ring-white/10'
        }
      >
        {headerSlot && (
          <PromptInputHeader className="px-4 pt-3">
            {headerSlot}
          </PromptInputHeader>
        )}

        {activeTemplate && (
          <ChatPromptTemplateHeader
            activeTemplate={activeTemplate}
            onOpenTemplateEditor={onOpenTemplateEditor}
            onReuseTemplate={onReuseTemplate}
            onRemoveTemplate={onRemoveTemplate}
          />
        )}

        <ChatPromptAttachmentHeader
          selectedSourceImages={selectedSourceImages}
          attachments={attachments}
          imageWorkflowActive={imageWorkflowActive}
          selectedAction={selectedAction}
          onRemoveSourceImage={onRemoveSourceImage}
          onClearSourceImages={onClearSourceImages}
          onRemoveAttachment={removeAttachment}
        />

        <PromptInputBody>
          <PromptInputTextarea
            ref={textareaRef}
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            aria-label={t('sendMessage')}
            placeholder={
              isEditMode
                ? t('imageWorkflow.editPlaceholder')
                : enableVideo
                  ? t('inputPlaceholderWithMedia')
                  : enableImages
                    ? t('inputPlaceholderWithImage')
                    : t('inputPlaceholder')
            }
            disabled={isStreaming}
          />
        </PromptInputBody>

        <ChatPromptFooter
          actionMenuOpen={actionMenuOpen}
          imageWorkflowActive={imageWorkflowActive}
          selectedAction={selectedAction}
          activeActionLabel={activeActionLabel}
          attachmentsCount={attachments.length}
          canSend={canSend}
          isStreaming={isStreaming}
          showEstimatedCost={showEstimatedCost}
          estimatedCost={estimatedCost}
          estimatingCost={estimatingCost}
          fileInputRef={fileInputRef}
          onToggleActionMenu={() => setActionMenuOpen((open) => !open)}
          onSelectAction={setSelectedAction}
          onFilesSelected={addAttachmentsFromFiles}
        />
      </PromptInput>
    </div>
  );
}
