'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { ArrowUp, Loader2, X, ImagePlus, AtSign, Plus } from 'lucide-react';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';
import { useTranslations } from 'next-intl';
import { meApi } from '@autix/shared-lib';

const MAX_IMAGES = 9;

const TYPE_TO_TAG: Record<string, string> = {
  SKILL: 'skill',
  MCP: 'mcp',
  AGENT: 'agent',
};

interface AcquiredItem {
  resourceType: 'SKILL' | 'MCP' | 'AGENT';
  resourceId: string;
  resource?: { id?: string; title?: string };
}

interface ChatInputProps {
  onSend: (content: string, images?: string[]) => void;
  isStreaming: boolean;
  enableImages?: boolean;
  imageWorkflowActive?: boolean;
  selectedSourceImages?: Array<{ url: string; prompt?: string }>;
  onGenerateImage?: (instruction?: string, images?: string[]) => void;
  onRemoveSourceImage?: (index: number) => void;
  onClearSourceImages?: () => void;
}

export function ChatInput({
  onSend,
  isStreaming,
  enableImages = false,
  imageWorkflowActive = false,
  selectedSourceImages = [],
  onGenerateImage,
  onRemoveSourceImage,
  onClearSourceImages,
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const t = useTranslations('chat');

  // ── @ 引用菜单 ────────────────────────────────────────────────
  const [mentionOpen, setMentionOpen] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<'chat' | 'image'>(
    imageWorkflowActive ? 'image' : 'chat',
  );
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionAnchor, setMentionAnchor] = useState<number>(0);
  const [acquired, setAcquired] = useState<AcquiredItem[]>([]);

  const loadAcquired = useCallback(async () => {
    try {
      const res = await meApi.resources('acquired');
      const data = res.data as { items: AcquiredItem[] };
      setAcquired((data.items ?? []).filter((it) => TYPE_TO_TAG[it.resourceType]));
    } catch {
      // 静默失败,@ 引用是辅助功能
    }
  }, []);

  useEffect(() => {
    if (mentionOpen && acquired.length === 0) loadAcquired();
  }, [mentionOpen, acquired.length, loadAcquired]);

  useEffect(() => {
    if (imageWorkflowActive) setSelectedAction('image');
    else setSelectedAction('chat');
  }, [imageWorkflowActive]);

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
      // 仅当 @ 后是连续非空白且未含特殊字符,才认定为提及触发
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

  const addImagesFromFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (fileArray.length === 0) return;

    const remaining = MAX_IMAGES - images.length;
    const toProcess = fileArray.slice(0, remaining);

    for (const file of toProcess) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setImages((prev) => {
          if (prev.length >= MAX_IMAGES) return prev;
          return [...prev, dataUrl];
        });
      };
      reader.readAsDataURL(file);
    }
  }, [images.length]);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!enableImages) return;
      if (!items) return;

      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        addImagesFromFiles(imageFiles);
      }
    },
    [enableImages, addImagesFromFiles],
  );

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = () => {
    if (isStreaming) return;
    if (imageWorkflowActive && selectedAction === 'image' && onGenerateImage) {
      onGenerateImage(input.trim() || undefined, images.length > 0 ? images : undefined);
      setInput('');
      setImages([]);
      setActionMenuOpen(false);
      return;
    }

    if (!input.trim() && images.length === 0) return;
    onSend(input.trim(), images.length > 0 ? images : undefined);
    setInput('');
    setImages([]);
    setActionMenuOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend =
    !isStreaming &&
    (
      (imageWorkflowActive && selectedAction === 'image' && !!onGenerateImage) ||
      !!input.trim() ||
      images.length > 0
    );
  const isEditMode = selectedSourceImages.length > 0;
  const activeActionLabel =
    imageWorkflowActive && selectedAction === 'image'
      ? t('imageWorkflow.image')
      : t('deepSearch');

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
                <span className="flex-1 truncate">
                  {it.resource?.title ?? it.resourceId}
                </span>
              </button>
            ))
          )}
        </div>
      )}
      <div
        className={cn(
          'relative flex flex-col overflow-hidden',
          'rounded-2xl border border-input bg-background shadow-xs',
          'transition-[color,box-shadow] duration-150',
          'focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50',
        )}
      >
        {selectedSourceImages.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto border-b border-border px-4 py-3">
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
        {enableImages && images.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pt-3">
            {imageWorkflowActive && (
              <span className="flex w-full text-xs text-muted-foreground">
                {t('imageWorkflow.referenceImage')}
              </span>
            )}
            {images.map((src, i) => (
              <div
                key={i}
                className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border"
              >
                <img
                  src={src}
                  alt={`pasted-${i}`}
                  className="h-full w-full object-cover"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-xs"
                  className="absolute right-0.5 top-0.5 rounded-full bg-background/80 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100"
                  aria-label={t('imageWorkflow.removeImage')}
                  onClick={() => removeImage(i)}
                >
                  <X />
                </Button>
              </div>
            ))}
          </div>
        )}

        <Textarea
          ref={textareaRef as React.RefObject<HTMLTextAreaElement>}
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          aria-label={t('sendMessage')}
          placeholder={
            isEditMode
              ? t('imageWorkflow.editPlaceholder')
              : enableImages
                ? t('inputPlaceholderWithImage')
                : t('inputPlaceholder')
          }
          disabled={isStreaming}
          className={cn(
            'min-h-[60px] w-full resize-none border-0 bg-transparent shadow-none',
            'px-5 pt-4 pb-2 text-sm leading-6 text-foreground',
            'placeholder:text-muted-foreground',
            'focus-visible:border-0 focus-visible:ring-0',
            'md:text-sm',
          )}
        />

        <div className="flex items-center justify-between gap-2 px-3 pb-2.5 pt-1">
          <div className="flex items-center gap-1">
            <div className="relative">
              {actionMenuOpen && imageWorkflowActive && (
                <div className="absolute bottom-full left-0 z-50 mb-2 w-44 overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-md">
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
                      {t('imageWorkflow.createImage')}
                    </span>
                    {selectedAction === 'image' && <span>✓</span>}
                  </button>
                </div>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Open actions"
                aria-expanded={actionMenuOpen}
                onClick={() => setActionMenuOpen((open) => !open)}
              >
                <Plus className="size-4" />
              </Button>
            </div>
            {imageWorkflowActive && selectedAction === 'image' && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-primary"
              >
                <ImagePlus />
                {activeActionLabel}
              </Button>
            )}
            {images.length > 0 && (
              <span className="ml-1 text-xs text-muted-foreground">
                {t('imageCount', { count: images.length, max: MAX_IMAGES })}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {t('sendShortcut')}
            </span>
            <Button
              type="button"
              size="icon-sm"
              className="rounded-full"
              onClick={handleSend}
              disabled={!canSend}
              aria-label={isStreaming ? t('generatingReply') : t('sendMessage')}
            >
              {isStreaming ? (
                <Loader2 className="animate-spin" />
              ) : (
                <ArrowUp />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
