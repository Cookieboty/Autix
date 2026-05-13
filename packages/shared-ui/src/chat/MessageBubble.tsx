'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Check, Download, ExternalLink, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '../ui/button';
import { Message, MessageActions, MessageContent } from '../ai-elements/message';
import { Response } from '../ai-elements/response';
import { Reasoning, ReasoningContent, ReasoningTrigger } from '../ai-elements/reasoning';
import { Loader } from '../ai-elements/loader';

export interface ImageResultItem {
  url: string;
  prompt?: string;
  generationId?: string;
  index?: number;
  sourceImages?: Array<{ url: string; prompt?: string }>;
}

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  images?: string[];
  thinking?: string;
  isStreaming?: boolean;
  messageType?: string;
  payload?: any;
  onGenerateImage?: (payload: {
    promptOverride?: string;
    editInstruction?: string;
    sourceImages?: Array<{
      url: string;
      prompt?: string;
      generationId?: string;
      index?: number;
    }>;
  }) => void;
  onSelectSourceImage?: (image: ImageResultItem) => void;
}

export function normalizeImageResultItems(
  images: unknown,
  fallbackPrompt?: string,
  fallbackGenerationId?: string,
): ImageResultItem[] {
  if (!Array.isArray(images)) return [];

  return images
    .map((image, index): ImageResultItem | null => {
      if (typeof image === 'string') {
        return {
          url: image,
          prompt: fallbackPrompt,
          generationId: fallbackGenerationId,
          index,
        };
      }

      if (!image || typeof image !== 'object') return null;
      const item = image as Record<string, unknown>;
      if (typeof item.url !== 'string') return null;

      return {
        url: item.url,
        prompt: typeof item.prompt === 'string' ? item.prompt : fallbackPrompt,
        generationId:
          typeof item.generationId === 'string'
            ? item.generationId
            : fallbackGenerationId,
        index: typeof item.index === 'number' ? item.index : index,
        sourceImages: Array.isArray(item.sourceImages)
          ? (item.sourceImages as Array<{ url: string; prompt?: string }>)
          : undefined,
      };
    })
    .filter((image): image is ImageResultItem => Boolean(image));
}

function filenameFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname;
    return pathname.split('/').filter(Boolean).pop() || 'image.png';
  } catch {
    return 'image.png';
  }
}

function ChatImage({
  src,
  alt = '',
  imageClassName,
  frameClassName,
  children,
}: {
  src: string;
  alt?: string;
  imageClassName?: string;
  frameClassName?: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const fileName = filenameFromUrl(src);
  const tp = useTranslations('chat.preview');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const copyLink = () => {
    navigator.clipboard.writeText(src).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };

  const overlay = open ? (
    <div
      className="fixed inset-0 z-[2147483646] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex max-h-[94vh] w-full max-w-6xl flex-col gap-3"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-xs text-white backdrop-blur transition-colors hover:bg-white/20"
            onClick={copyLink}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? tp('linkCopied') : tp('copyLink')}
          </button>
          <a
            href={src}
            download={fileName}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-xs text-white backdrop-blur transition-colors hover:bg-white/20"
          >
            <Download className="h-3.5 w-3.5" />
            {tp('download')}
          </a>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-xs text-white backdrop-blur transition-colors hover:bg-white/20"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {tp('openOriginal')}
          </a>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/12 text-white backdrop-blur transition-colors hover:bg-white/20"
            onClick={() => setOpen(false)}
            aria-label={tp('close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl bg-black/35 p-2">
          <img
            src={src}
            alt={alt}
            className="max-h-[85vh] max-w-[92vw] object-contain"
          />
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div
        className={`relative overflow-hidden rounded-lg border border-border bg-secondary ${frameClassName ?? ''}`}
      >
        <button
          type="button"
          className="flex h-full w-full cursor-zoom-in items-center justify-center"
          onClick={() => setOpen(true)}
        >
          <img
            src={src}
            alt={alt}
            className={`max-w-full rounded-lg object-contain ${imageClassName ?? ''}`}
          />
        </button>
        {children}
      </div>

      {mounted && overlay ? createPortal(overlay, document.body) : null}
    </>
  );
}

function ImageWorkflowCard({
  messageType,
  payload,
  onGenerateImage,
  onSelectSourceImage,
}: Pick<
  MessageBubbleProps,
  'messageType' | 'payload' | 'onGenerateImage' | 'onSelectSourceImage'
>) {
  if (messageType === 'prompt_suggestion') {
    return (
      <div className="rounded-lg p-4 space-y-3 border border-border bg-card">
        <div className="text-xs font-medium text-muted-foreground">Prompt 建议</div>
        <p className="whitespace-pre-wrap text-sm leading-6">{payload?.prompt}</p>
        {payload?.reasoning && (
          <p className="text-xs text-muted-foreground">{payload.reasoning}</p>
        )}
        <Button
          size="sm"
          onClick={() => onGenerateImage?.({ promptOverride: payload?.prompt })}
        >
          生成图片
        </Button>
      </div>
    );
  }

  if (messageType === 'edit_suggestion') {
    const sourceImages = payload?.sourceImages ?? [];
    return (
      <div className="rounded-lg p-4 space-y-3 border border-border bg-card">
        <div className="text-xs font-medium text-muted-foreground">编辑建议</div>
        {sourceImages.length > 0 && (
          <div className="flex gap-2 overflow-x-auto">
            {sourceImages.map((image: any, index: number) => (
              <img
                key={`${image.url}-${index}`}
                src={image.url}
                alt=""
                className="h-16 w-16 rounded object-cover"
              />
            ))}
          </div>
        )}
        <p className="whitespace-pre-wrap text-sm leading-6">{payload?.instruction}</p>
        {payload?.reasoning && (
          <p className="text-xs text-muted-foreground">{payload.reasoning}</p>
        )}
        <Button
          size="sm"
          onClick={() =>
            onGenerateImage?.({
              editInstruction: payload?.instruction,
              sourceImages,
            })
          }
        >
          编辑图片
        </Button>
      </div>
    );
  }

  if (messageType === 'image_result') {
    const images = normalizeImageResultItems(
      payload?.images,
      payload?.prompt,
      payload?.generationId,
    );
    const sourceImages = payload?.sourceImages ?? [];
    return (
      <div className="rounded-lg p-4 space-y-3 border border-border bg-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-muted-foreground">图片结果</div>
            <div className="text-[11px] text-muted-foreground">{payload?.model}</div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              onGenerateImage?.({ promptOverride: payload?.prompt, sourceImages })
            }
          >
            重新生成
          </Button>
        </div>
        {payload?.prompt && (
          <p className="rounded-md p-2 text-xs leading-5 bg-secondary text-foreground">
            {payload.prompt}
          </p>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {images.map((source, index) => (
            <ChatImage
              key={`${source.url}-${index}`}
              src={source.url}
              frameClassName="min-h-40"
              imageClassName="max-h-[520px] w-full"
            >
              <button
                type="button"
                className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/70"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectSourceImage?.(source);
                }}
              >
                编辑
              </button>
            </ChatImage>
          ))}
        </div>
      </div>
    );
  }

  if (messageType === 'image_generating' || messageType === 'image_editing') {
    return (
      <div className="rounded-lg p-4 text-sm border border-border bg-card">
        {messageType === 'image_editing' ? '正在编辑图片...' : '正在生成图片...'}
      </div>
    );
  }

  return null;
}

export function MessageBubble({
  role,
  content,
  images = [],
  thinking,
  isStreaming,
  messageType,
  payload,
  onGenerateImage,
  onSelectSourceImage,
}: MessageBubbleProps) {
  const isUser = role === 'user';
  const [copiedReply, setCopiedReply] = useState(false);
  const t = useTranslations('chat');
  const shouldRenderWorkflowCard =
    !isUser &&
    (messageType === 'prompt_suggestion' ||
      messageType === 'edit_suggestion' ||
      messageType === 'image_result' ||
      messageType === 'image_generating' ||
      messageType === 'image_editing');

  const handleCopyReply = () => {
    if (!content) return;
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard
      .writeText(content)
      .then(() => {
        setCopiedReply(true);
        setTimeout(() => setCopiedReply(false), 1600);
      })
      .catch(() => {
        /* no-op: clipboard unavailable */
      });
  };

  return (
    <Message from={isUser ? 'user' : 'assistant'} className="max-w-full">
      {!isUser && thinking && (
        <Reasoning isStreaming={isStreaming} className="w-full max-w-[720px]">
          <ReasoningTrigger />
          <ReasoningContent>{thinking}</ReasoningContent>
        </Reasoning>
      )}

      <MessageContent
        className={isUser ? 'max-w-[78%] break-words' : 'w-full max-w-[720px]'}
      >
        {shouldRenderWorkflowCard ? (
          <ImageWorkflowCard
            messageType={messageType}
            payload={payload}
            onGenerateImage={onGenerateImage}
            onSelectSourceImage={onSelectSourceImage}
          />
        ) : content === '' && isStreaming ? (
          <Loader />
        ) : isUser ? (
          <div className="space-y-2">
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {images.map((src, index) => (
                  <ChatImage
                    key={`${src}-${index}`}
                    src={src}
                    frameClassName="max-w-full p-1"
                    imageClassName="max-h-64"
                  />
                ))}
              </div>
            )}
            {content && (
              <p className="whitespace-pre-wrap text-[15px] leading-7">{content}</p>
            )}
          </div>
        ) : (
          <div className="text-[15px] leading-7">
            <Response>{content}</Response>
            {isStreaming && (
              <span className="ml-1 inline-block h-4 w-0.5 animate-pulse align-middle bg-foreground" />
            )}
          </div>
        )}
      </MessageContent>

      {!isUser && content && !isStreaming && (
        <MessageActions className="px-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 min-w-8 p-0 rounded-full cursor-pointer"
            onClick={handleCopyReply}
            aria-label={copiedReply ? t('copied') : t('copyReply')}
            title={copiedReply ? t('copied') : t('copyReply')}
          >
            {copiedReply ? (
              <Check className="h-3.5 w-3.5 text-foreground" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </Button>
        </MessageActions>
      )}
    </Message>
  );
}
