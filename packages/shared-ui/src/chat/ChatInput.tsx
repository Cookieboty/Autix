'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { ArrowUp, Loader2, X, ImagePlus, AtSign, Plus } from 'lucide-react';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
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
  onGenerateImage?: (instruction?: string) => void;
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
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      if (!enableImages) return;
      const items = e.clipboardData?.items;
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
      onGenerateImage(input.trim() || undefined);
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
      ? '图片'
      : t('deepSearch');

  return (
    <div className="relative flex flex-col gap-2">
      {mentionOpen && (
        <div
          className="absolute bottom-full left-0 mb-2 w-72 rounded-lg shadow-lg z-50"
          style={{
            backgroundColor: 'var(--overlay)',
            border: '1px solid var(--border)',
          }}
        >
          <div
            className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1"
            style={{ color: 'var(--muted)' }}
          >
            <AtSign className="w-3 h-3" /> 引用资源
          </div>
          {filteredMentions.length === 0 ? (
            <div className="px-3 py-2 text-xs" style={{ color: 'var(--muted)' }}>
              没有可引用的已获取资源
            </div>
          ) : (
            filteredMentions.map((it) => (
              <button
                key={`${it.resourceType}-${it.resourceId}`}
                onClick={() => insertMention(it)}
                className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-[var(--panel-muted)]"
                style={{ color: 'var(--foreground)' }}
              >
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: 'var(--panel-muted)',
                    color: 'var(--muted)',
                  }}
                >
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
        className="overflow-hidden rounded-lg"
        style={{
          backgroundColor: 'var(--panel)',
          border: '1px solid var(--input-border)',
        }}
      >
        {selectedSourceImages.length > 0 && (
          <div
            className="flex items-center gap-2 overflow-x-auto px-5 pt-3"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--muted)' }}>
              正在基于 {selectedSourceImages.length} 张图编辑
            </span>
            {selectedSourceImages.map((image, index) => (
              <div key={`${image.url}-${index}`} className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-md">
                <img src={image.url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
                  onClick={() => onRemoveSourceImage?.(index)}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="ml-auto flex-shrink-0 text-xs underline"
              style={{ color: 'var(--muted)' }}
              onClick={onClearSourceImages}
            >
              清空
            </button>
          </div>
        )}
        {enableImages && images.length > 0 && (
          <div className="flex flex-wrap gap-2 px-5 pt-3">
            {images.map((src, i) => (
              <div
                key={i}
                className="relative group w-16 h-16 rounded-lg overflow-hidden flex-shrink-0"
                style={{ border: '1px solid var(--border)' }}
              >
                <img
                  src={src}
                  alt={`pasted-${i}`}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    color: '#fff',
                  }}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="px-5 pt-4 pb-2">
          <div
            className="rounded-md px-1"
            style={{ backgroundColor: 'transparent' }}
          >
            <Textarea
              ref={textareaRef as React.RefObject<HTMLTextAreaElement>}
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              aria-label={t('sendMessage')}
              placeholder={
                isEditMode
                  ? '描述你想怎么修改这张图片'
                  : enableImages
                    ? t('inputPlaceholderWithImage')
                    : t('inputPlaceholder')
              }
              disabled={isStreaming}
              className="w-full resize-none bg-transparent text-[15px] leading-7 text-[var(--foreground)] placeholder:text-[var(--muted)] outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between px-4 pb-4 pt-1">
          <div className="flex items-center gap-2">
            <div className="relative">
              {actionMenuOpen && imageWorkflowActive && (
                <div
                  className="absolute bottom-full left-0 z-50 mb-2 w-44 rounded-2xl p-2 shadow-xl"
                  style={{
                    backgroundColor: 'var(--overlay)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm"
                    style={{
                      color: selectedAction === 'image' ? 'var(--accent)' : 'var(--foreground)',
                      backgroundColor: selectedAction === 'image' ? 'var(--panel-muted)' : 'transparent',
                    }}
                    onClick={() => {
                      setSelectedAction('image');
                      setActionMenuOpen(false);
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <ImagePlus className="h-4 w-4" />
                      创建图片
                    </span>
                    {selectedAction === 'image' && <span>✓</span>}
                  </button>
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-9 min-w-9 rounded-full cursor-pointer"
                aria-label="Open actions"
                style={{ color: 'var(--foreground)', backgroundColor: actionMenuOpen ? 'var(--panel-muted)' : 'transparent' }}
                onClick={() => setActionMenuOpen((open) => !open)}
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addImagesFromFiles(e.target.files);
                e.target.value = '';
                setActionMenuOpen(false);
              }}
            />

            {imageWorkflowActive && selectedAction === 'image' && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 rounded-full px-3 text-xs font-medium cursor-pointer"
                style={{
                  color: 'var(--accent)',
                  backgroundColor: 'transparent',
                }}
              >
                <ImagePlus className="mr-1.5 h-3.5 w-3.5" />
                {activeActionLabel}
              </Button>
            )}
            {images.length > 0 && (
              <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
                {t('imageCount', { count: images.length, max: MAX_IMAGES })}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
              {t('sendShortcut')}
            </span>
            <Button
              
              onClick={handleSend}
              disabled={!canSend}
              aria-label={isStreaming ? t('generatingReply') : t('sendMessage')}
              className="h-10 w-10 min-w-10 rounded-full cursor-pointer transition-opacity"
              style={{
                backgroundColor: canSend ? 'var(--foreground)' : 'var(--surface-tertiary)',
                color: canSend ? 'var(--panel)' : 'var(--muted)',
                opacity: canSend ? 1 : 0.7,
              }}
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
