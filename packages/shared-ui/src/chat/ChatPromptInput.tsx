'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { AtSign, Coins, FileText, ImagePlus, Loader2, Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  marketplaceActions,
  type AgentKind,
} from '@autix/shared-store';
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  PromptInputButton,
  type PromptInputMessage,
} from '../ai-elements/prompt-input';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';
import {
  CHAT_ATTACHMENT_ACCEPT,
  getAttachmentKind,
  isSupportedChatAttachment,
  shouldUseImageGeneration,
  type ChatAttachmentInput,
  type LocalChatAttachment,
} from './chat-attachments';

const MAX_ATTACHMENTS = 9;

const TYPE_TO_TAG: Record<string, string> = {
  SKILL: 'skill',
  MCP: 'mcp',
  AGENT: 'agent',
};

function revokeLocalAttachment(attachment: LocalChatAttachment) {
  if (attachment.file && attachment.url.startsWith('blob:')) {
    URL.revokeObjectURL(attachment.url);
  }
}

interface AcquiredItem {
  resourceType: 'SKILL' | 'MCP' | 'AGENT';
  resourceId: string;
  resource?: { id?: string; title?: string };
}

interface ChatPromptInputProps {
  onSend: (content: string, attachments?: LocalChatAttachment[]) => void;
  isStreaming: boolean;
  inputKind?: AgentKind;
  resetToken?: number;
  enableImages?: boolean;
  enableVideo?: boolean;
  imageWorkflowActive?: boolean;
  selectedSourceImages?: Array<{ url: string; prompt?: string }>;
  onGenerateImage?: (instruction?: string, attachments?: LocalChatAttachment[]) => void;
  onRemoveSourceImage?: (index: number) => void;
  onClearSourceImages?: () => void;
  activeTemplate?: {
    id: string;
    title: string;
    coverImage?: string;
    variableCount: number;
    editable?: boolean;
  };
  onOpenTemplateEditor?: () => void;
  onReuseTemplate?: () => void;
  onRemoveTemplate?: () => void;
  injectValue?: { content: string; images?: string[]; attachments?: ChatAttachmentInput[]; token: number };
  glassEffect?: boolean;
  headerSlot?: React.ReactNode;
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
  const [attachments, setAttachments] = useState<LocalChatAttachment[]>([]);
  const attachmentsRef = useRef<LocalChatAttachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = useTranslations('chat');

  const [mentionOpen, setMentionOpen] = useState(false);

  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<'chat' | 'image'>('chat');
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionAnchor, setMentionAnchor] = useState<number>(0);
  const [acquired, setAcquired] = useState<AcquiredItem[]>([]);

  const loadAcquired = useCallback(async () => {
    try {
      const items = await marketplaceActions.listAcquiredResources();
      setAcquired((items as AcquiredItem[]).filter((it) => TYPE_TO_TAG[it.resourceType]));
    } catch {
      // 静默失败,@ 引用是辅助功能
    }
  }, []);

  useEffect(() => {
    if (mentionOpen && acquired.length === 0) loadAcquired();
  }, [mentionOpen, acquired.length, loadAcquired]);

  useEffect(() => {
    if (!imageWorkflowActive) setSelectedAction('chat');
  }, [imageWorkflowActive]);

  useEffect(() => {
    if (!injectValue) return;
    setInput(injectValue.content);
    const injectedAttachments = [
      ...(injectValue.attachments ?? []),
      ...(injectValue.images ?? []).map((url, index) => ({
        url,
        name: `image-${index + 1}`,
        mimeType: 'image/png',
        size: 0,
      })),
    ];
    setAttachments(
      injectedAttachments.slice(0, MAX_ATTACHMENTS).map((attachment, index) => ({
        ...attachment,
        id: `injected-${injectValue.token}-${index}`,
        kind: getAttachmentKind(attachment.mimeType),
      })),
    );
    const rafId = requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    });
    return () => cancelAnimationFrame(rafId);
  }, [injectValue?.token]);

  const filteredMentions = useMemo(() => {
    const q = mentionQuery.trim().toLowerCase();
    if (!q) return acquired.slice(0, 8);
    return acquired
      .filter((it) => (it.resource?.title ?? '').toLowerCase().includes(q))
      .slice(0, 8);
  }, [mentionQuery, acquired]);

  const handleInputChange = (val: string) => {
    setInput(val);
    const ta = textareaRef.current;
    const caret = ta?.selectionStart ?? val.length;
    const before = val.slice(0, caret);
    const atIdx = before.lastIndexOf('@');
    if (atIdx >= 0) {
      const slice = before.slice(atIdx + 1);
      if (/^[\w-\u4e00-\u9fa5]*$/.test(slice)) {
        setMentionAnchor(atIdx);
        setMentionQuery(slice);
        setMentionOpen(true);
        return;
      }
    }
    setMentionOpen(false);
  };

  const insertMention = (item: AcquiredItem) => {
    const tag = TYPE_TO_TAG[item.resourceType];
    if (!tag) return;
    const id = item.resourceId;
    const marker = `@${tag}:${id} `;
    const before = input.slice(0, mentionAnchor);
    const ta = textareaRef.current;
    const caret = ta?.selectionStart ?? input.length;
    const after = input.slice(caret);
    const next = before + marker + after;
    setInput(next);
    setMentionOpen(false);
    setMentionQuery('');
    requestAnimationFrame(() => {
      const pos = before.length + marker.length;
      ta?.focus();
      ta?.setSelectionRange(pos, pos);
    });
  };

  const clearAttachments = useCallback(() => {
    setAttachments((prev) => {
      prev.forEach(revokeLocalAttachment);
      return [];
    });
  }, []);

  useEffect(() => {
    if (resetToken == null) return;
    setInput('');
    clearAttachments();
    setSelectedAction('chat');
    setActionMenuOpen(false);
  }, [resetToken, clearAttachments]);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => () => {
    attachmentsRef.current.forEach(revokeLocalAttachment);
  }, []);

  const addAttachmentsFromFiles = useCallback(
    (files: FileList | File[]) => {
      const incoming = Array.from(files);
      const fileArray = incoming.filter(isSupportedChatAttachment);
      if (fileArray.length === 0) {
        toast.warning(t('attachments.unsupportedType'));
        return;
      }

      const remaining = MAX_ATTACHMENTS - attachments.length;
      if (remaining <= 0) {
        toast.warning(t('attachments.maxReached', { max: MAX_ATTACHMENTS }));
        return;
      }
      const toProcess = fileArray.slice(0, remaining);
      if (fileArray.length > remaining) {
        toast.warning(t('attachments.maxRemaining', { remaining }));
      }

      const next = toProcess.map((file) => ({
        id: `file-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        url: file.type.startsWith('image/') || file.type.startsWith('video/')
          ? URL.createObjectURL(file)
          : '',
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        kind: getAttachmentKind(file.type || 'application/octet-stream'),
      }));

      setAttachments((prev) => [...prev, ...next]);
    },
    [attachments.length, t],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const file = item.getAsFile();
        if (file && isSupportedChatAttachment(file)) files.push(file);
      }

      if (files.length > 0) {
        e.preventDefault();
        const allMedia = files.every((file) =>
          file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/'),
        );
        if (onPasteFiles && enableVideo && allMedia) {
          onPasteFiles(files);
        } else {
          addAttachmentsFromFiles(files);
        }
      }
    },
    [enableVideo, addAttachmentsFromFiles, onPasteFiles],
  );

  const removeAttachment = (index: number) => {
    setAttachments((prev) => {
      const target = prev[index];
      if (target) revokeLocalAttachment(target);
      return prev.filter((_, i) => i !== index);
    });
  };

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionOpen && e.key === 'Escape') {
      e.preventDefault();
      setMentionOpen(false);
      return;
    }
    if (mentionOpen && e.key === 'Enter' && filteredMentions.length > 0) {
      e.preventDefault();
      insertMention(filteredMentions[0]);
      return;
    }
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
      {mentionOpen && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-72 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-md">
          <div className="flex items-center gap-1 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <AtSign className="size-3" /> {t('mentions.title')}
          </div>
          {filteredMentions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              {t('mentions.empty')}
            </div>
          ) : (
            filteredMentions.map((it) => (
              <button
                key={`${it.resourceType}-${it.resourceId}`}
                onClick={() => insertMention(it)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
              >
                <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
                  {it.resourceType}
                </span>
                <span className="flex-1 truncate">{it.resource?.title ?? it.resourceId}</span>
              </button>
            ))
          )}
        </div>
      )}
      {actionMenuOpen && (
        <div className="absolute bottom-12 left-3 z-50 mb-2 w-48 overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-md">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
            onClick={() => {
              fileInputRef.current?.click();
              setActionMenuOpen(false);
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
                setSelectedAction('image');
                setActionMenuOpen(false);
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
      )}

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
          <PromptInputHeader className="flex items-center gap-2 border-b border-border px-4 py-2">
            {activeTemplate.coverImage && (
              <img
                src={activeTemplate.coverImage}
                alt=""
                className="size-8 shrink-0 rounded-md object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <span className="truncate text-sm font-medium text-foreground">
                {activeTemplate.title}
              </span>
              {activeTemplate.variableCount > 0 && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {t('template.variableCount', { count: activeTemplate.variableCount })}
                </span>
              )}
            </div>
            {onReuseTemplate && (
              <button
                type="button"
                onClick={onReuseTemplate}
                className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
              >
                {t('template.reusePrompt')}
              </button>
            )}
            {onOpenTemplateEditor && (activeTemplate.editable ?? activeTemplate.variableCount > 0) && (
              <button
                type="button"
                onClick={onOpenTemplateEditor}
                className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
              >
                {t('template.edit')}
              </button>
            )}
            <button
              type="button"
              onClick={onRemoveTemplate}
              className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
              aria-label={t('template.removeTemplate')}
            >
              <X className="size-3.5" />
            </button>
          </PromptInputHeader>
        )}

        {(selectedSourceImages.length > 0 || attachments.length > 0) && (
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
                        onClick={() => removeAttachment(i)}
                      >
                        <X />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </PromptInputHeader>
        )}

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
                  if (event.target.files) addAttachmentsFromFiles(event.target.files);
                  event.target.value = '';
                }}
              />
              <PromptInputButton
                aria-label="Open actions"
                aria-expanded={actionMenuOpen}
                onClick={() => setActionMenuOpen((open) => !open)}
              >
                <Plus className="size-4" />
              </PromptInputButton>
            </div>
            {imageWorkflowActive && selectedAction === 'image' && (
              <PromptInputButton
                variant="ghost"
                size="sm"
                className="text-primary"
                onClick={() => setSelectedAction('chat')}
                aria-label={t('imageWorkflow.cancelGeneration')}
              >
                <ImagePlus />
                {activeActionLabel}
                <X className="size-3" />
              </PromptInputButton>
            )}
            {attachments.length > 0 && (
              <span className="ml-1 text-xs text-muted-foreground">
                {attachments.length}/{MAX_ATTACHMENTS}
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
      </PromptInput>
    </div>
  );
}
