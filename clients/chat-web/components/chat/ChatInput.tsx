'use client';

import { useState, useRef, useCallback } from 'react';
import { Paperclip, Globe, ChevronDown, ArrowUp, Loader2, X, ImagePlus } from 'lucide-react';
import { TextArea, Button } from '@heroui/react';

const MAX_IMAGES = 9;

interface ChatInputProps {
  onSend: (content: string, images?: string[]) => void;
  isStreaming: boolean;
  enableImages?: boolean;
}

export function ChatInput({ onSend, isStreaming, enableImages = false }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if ((!input.trim() && images.length === 0) || isStreaming) return;
    onSend(input.trim(), images.length > 0 ? images : undefined);
    setInput('');
    setImages([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = (!!input.trim() || images.length > 0) && !isStreaming;

  return (
    <div className="flex flex-col gap-2">
      <div
        className="overflow-hidden rounded-lg"
        style={{
          backgroundColor: 'var(--panel)',
          border: '1px solid var(--input-border)',
        }}
      >
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
            <TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              aria-label="消息输入框"
              placeholder={enableImages ? '输入文本或粘贴图片' : '请输入您的需求'}
              disabled={isStreaming}
              className="w-full resize-none bg-transparent text-[15px] leading-7 text-[var(--foreground)] placeholder:text-[var(--muted)] outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between px-4 pb-4 pt-1">
          <div className="flex items-center gap-2">
            {enableImages ? (
              <>
                <Button
                  isIconOnly
                  variant="ghost"
                  size="sm"
                  className="h-9 min-w-9 rounded-full cursor-pointer"
                  isDisabled={images.length >= MAX_IMAGES}
                  aria-label="添加图片"
                  style={{ color: 'var(--muted)' }}
                  onPress={() => fileInputRef.current?.click()}
                >
                  <ImagePlus className="h-4 w-4" />
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) addImagesFromFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
                <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
                  {images.length > 0 && `${images.length}/${MAX_IMAGES} 张`}
                </span>
              </>
            ) : (
              <>
                <Button
                  isIconOnly
                  variant="ghost"
                  size="sm"
                  className="h-9 min-w-9 rounded-full cursor-pointer"
                  isDisabled
                  aria-label="Attach file"
                  style={{ color: 'var(--muted)' }}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 rounded-full px-3 text-xs font-medium cursor-pointer"
                  style={{
                    backgroundColor: 'var(--panel-muted)',
                    color: 'var(--foreground)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <Globe className="mr-1.5 h-3.5 w-3.5" style={{ color: 'var(--muted)' }} />
                  Deep Search
                  <ChevronDown className="ml-1 h-3 w-3" style={{ color: 'var(--muted)' }} />
                </Button>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
              ⌘/Ctrl + Enter 发送
            </span>
            <Button
              isIconOnly
              onPress={handleSend}
              isDisabled={!canSend}
              aria-label={isStreaming ? '正在生成回复' : '发送消息'}
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
