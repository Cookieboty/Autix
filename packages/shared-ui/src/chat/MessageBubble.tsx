'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Copy, Check, FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ChatAttachment } from '@autix/shared-store';
import { Button } from '../ui/button';
import { Message, MessageActions, MessageContent } from '../ai-elements/message';
import { Response } from '../ai-elements/response';
import { Reasoning, ReasoningContent, ReasoningTrigger } from '../ai-elements/reasoning';
import { Loader } from '../ai-elements/loader';
import { useImagePreview } from './ImagePreview';

export interface ImageResultItem {
  url: string;
  prompt?: string;
  generationId?: string;
  index?: number;
  sourceImages?: Array<{ url: string; prompt?: string }>;
}

type ImageWorkflowPayload = {
  prompt?: string;
  reasoning?: string;
  instruction?: string;
  sourceImages?: ImageResultItem[];
  images?: unknown;
  generationId?: string;
  model?: string;
};

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  images?: string[];
  attachments?: ChatAttachment[];
  thinking?: string;
  isStreaming?: boolean;
  messageType?: string;
  payload?: unknown;
  timestamp?: Date | string | number | null;
  durationMs?: number;
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

function readSourceImages(value: unknown): ImageResultItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((image, index): ImageResultItem | null => {
      if (!image || typeof image !== 'object') return null;
      const item = image as Record<string, unknown>;
      if (typeof item.url !== 'string') return null;

      return {
        url: item.url,
        prompt: typeof item.prompt === 'string' ? item.prompt : undefined,
        generationId:
          typeof item.generationId === 'string' ? item.generationId : undefined,
        index: typeof item.index === 'number' ? item.index : index,
      };
    })
    .filter((image): image is ImageResultItem => Boolean(image));
}

function readImageWorkflowPayload(value: unknown): ImageWorkflowPayload {
  return value && typeof value === 'object'
    ? (value as ImageWorkflowPayload)
    : {};
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
  const { openPreview, element } = useImagePreview();

  return (
    <>
      <div
        className={`relative overflow-hidden rounded-lg border border-border bg-secondary ${frameClassName ?? ''}`}
      >
        <button
          type="button"
          className="flex h-full w-full cursor-zoom-in items-center justify-center"
          onClick={() => openPreview(src, alt)}
        >
          <img
            src={src}
            alt={alt}
            className={`max-w-full rounded-lg object-contain ${imageClassName ?? ''}`}
          />
        </button>
        {children}
      </div>
      {element}
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
  const t = useTranslations('chat.imageWorkflow');
  const workflowPayload = readImageWorkflowPayload(payload);

  if (messageType === 'prompt_suggestion') {
    return (
      <div className="rounded-lg p-4 space-y-3 border border-border bg-card">
        <div className="text-xs font-medium text-muted-foreground">{t('promptSuggestion')}</div>
        <p className="whitespace-pre-wrap text-sm leading-6">{workflowPayload.prompt}</p>
        {workflowPayload.reasoning && (
          <p className="text-xs text-muted-foreground">{workflowPayload.reasoning}</p>
        )}
        <Button
          size="sm"
          onClick={() => onGenerateImage?.({ promptOverride: workflowPayload.prompt })}
        >
          {t('generateImage')}
        </Button>
      </div>
    );
  }

  if (messageType === 'edit_suggestion') {
    const sourceImages = readSourceImages(workflowPayload.sourceImages);
    return (
      <div className="rounded-lg p-4 space-y-3 border border-border bg-card">
        <div className="text-xs font-medium text-muted-foreground">{t('editSuggestion')}</div>
        {sourceImages.length > 0 && (
          <div className="flex gap-2 overflow-x-auto">
            {sourceImages.map((image, index) => (
              <img
                key={`${image.url}-${index}`}
                src={image.url}
                alt=""
                className="h-16 w-16 rounded object-cover"
              />
            ))}
          </div>
        )}
        <p className="whitespace-pre-wrap text-sm leading-6">{workflowPayload.instruction}</p>
        {workflowPayload.reasoning && (
          <p className="text-xs text-muted-foreground">{workflowPayload.reasoning}</p>
        )}
        <Button
          size="sm"
          onClick={() =>
            onGenerateImage?.({
              editInstruction: workflowPayload.instruction,
              sourceImages,
            })
          }
        >
          {t('editImage')}
        </Button>
      </div>
    );
  }

  if (messageType === 'image_result') {
    const images = normalizeImageResultItems(
      workflowPayload.images,
      workflowPayload.prompt,
      workflowPayload.generationId,
    );
    const sourceImages = readSourceImages(workflowPayload.sourceImages);
    return (
      <div className="rounded-lg p-4 space-y-3 border border-border bg-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-muted-foreground">{t('imageResult')}</div>
            <div className="text-[11px] text-muted-foreground">{workflowPayload.model}</div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              onGenerateImage?.({ promptOverride: workflowPayload.prompt, sourceImages })
            }
          >
            {t('regenerateFromPrompt')}
          </Button>
        </div>
        {workflowPayload.prompt && (
          <p className="rounded-md p-2 text-xs leading-5 bg-secondary text-foreground">
            {workflowPayload.prompt}
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
                {t('useAsEditSource')}
              </button>
            </ChatImage>
          ))}
        </div>
      </div>
    );
  }

  if (messageType === 'image_generating' || messageType === 'image_editing') {
    const sourceImages = readSourceImages(workflowPayload.sourceImages);
    return (
      <div className="rounded-lg p-4 text-sm border border-border bg-card">
        <div className="font-medium">
          {messageType === 'image_editing' ? t('editingImage') : t('generatingImage')}
        </div>
        {sourceImages.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {sourceImages.map((image, index) => (
              <img
                key={`${image.url}-${index}`}
                src={image.url}
                alt=""
                className="h-14 w-14 rounded object-cover"
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}

export function MessageBubble({
  role,
  content,
  images = [],
  attachments = [],
  thinking,
  isStreaming,
  messageType,
  payload,
  timestamp,
  durationMs,
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

  const { formattedTimestamp, tooltipTimestamp } = useMemo(() => {
    if (timestamp === null || timestamp === undefined || timestamp === '') {
      return { formattedTimestamp: '', tooltipTimestamp: '' };
    }
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return { formattedTimestamp: '', tooltipTimestamp: '' };
    }
    const now = new Date();
    const sameDay =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();
    const time = date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
    const formatted = sameDay
      ? time
      : `${date.toLocaleDateString(undefined, {
        month: '2-digit',
        day: '2-digit',
      })} ${time}`;
    return {
      formattedTimestamp: formatted,
      tooltipTimestamp: date.toLocaleString(),
    };
  }, [timestamp]);

  const formattedDuration = useMemo(() => {
    if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs < 0) {
      return '';
    }
    if (durationMs < 1000) {
      return `${durationMs} ms`;
    }
    const seconds = durationMs / 1000;
    if (seconds < 60) {
      return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds - mins * 60);
    return `${mins}m ${secs}s`;
  }, [durationMs]);
  const displayImages =
    attachments.length > 0
      ? attachments.filter((attachment) => attachment.kind === 'image').map((attachment) => attachment.url)
      : images;
  const fileAttachments = attachments.filter((attachment) => attachment.kind !== 'image');

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
            {displayImages.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {displayImages.map((src, index) => (
                  <ChatImage
                    key={`${src}-${index}`}
                    src={src}
                    frameClassName="max-w-full p-1"
                    imageClassName="max-h-64"
                  />
                ))}
              </div>
            )}
            {fileAttachments.length > 0 && (
              <div className="flex flex-col gap-2">
                {fileAttachments.map((attachment) => (
                  <a
                    key={attachment.url}
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex max-w-sm items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                  >
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {Math.ceil(attachment.size / 1024)}KB
                    </span>
                  </a>
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

      {!isUser && content && (
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
          {formattedTimestamp && (
            <span
              className="ml-1 select-none text-[11px] leading-none text-muted-foreground/80"
              title={tooltipTimestamp ?? undefined}
            >
              {formattedTimestamp}
            </span>
          )}
          {formattedDuration && (
            <span
              className="ml-1 select-none text-[11px] leading-none text-muted-foreground/70"
              title={`${durationMs} ms`}
            >
              · {formattedDuration}
            </span>
          )}
        </MessageActions>
      )}

      {isUser && formattedTimestamp && (
        <div
          className="mt-1 px-1 text-right text-[11px] leading-none text-muted-foreground/80"
          title={tooltipTimestamp ?? undefined}
        >
          {formattedTimestamp}
        </div>
      )}
    </Message>
  );
}
