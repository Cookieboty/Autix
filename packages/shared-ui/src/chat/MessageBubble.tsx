'use client';

import { useState } from 'react';
import { ThumbsUp, MoreHorizontal, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Button } from '../ui/button';
import { useTranslations } from 'next-intl';

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
  thinking?: string;
  isStreaming?: boolean;
  messageType?: string;
  payload?: any;
  onGenerateImage?: (payload: {
    promptOverride?: string;
    editInstruction?: string;
    sourceImages?: Array<{ url: string; prompt?: string; generationId?: string; index?: number }>;
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

function CodeBlock({ language, children }: { language: string; children: string }) {
  const [copied, setCopied] = useState(false);
  const t = useTranslations('chat');
  const isDarkTheme =
    typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';

  const handleCopy = () => {
    navigator.clipboard.writeText(children).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      className="relative my-4 overflow-hidden rounded-lg"
      style={{
        border: '1px solid var(--border)',
        backgroundColor: 'var(--panel)',
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-2.5 text-xs"
        style={{
          backgroundColor: 'var(--panel-muted)',
          color: 'var(--muted)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span>{language || 'code'}</span>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1.5 rounded-md text-xs cursor-pointer"
          onClick={handleCopy}
          style={{ color: copied ? 'var(--foreground)' : 'var(--muted)' }}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? t('copied') : t('copy')}
        </Button>
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={isDarkTheme ? oneDark : oneLight}
        customStyle={{
          margin: 0,
          borderRadius: 0,
          fontSize: '0.82rem',
          lineHeight: '1.7',
          padding: '1rem 1.1rem',
          background: 'transparent',
        }}
        showLineNumbers={children.split('\n').length > 5}
        lineNumberStyle={{ color: 'var(--muted)', fontSize: '0.75rem', minWidth: '2.5rem' }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
}

function ImageWorkflowCard({
  messageType,
  payload,
  onGenerateImage,
  onSelectSourceImage,
}: Pick<MessageBubbleProps, 'messageType' | 'payload' | 'onGenerateImage' | 'onSelectSourceImage'>) {
  if (messageType === 'prompt_suggestion') {
    return (
      <div className="rounded-lg p-4 space-y-3" style={{ border: '1px solid var(--border)', backgroundColor: 'var(--panel)' }}>
        <div className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Prompt 建议</div>
        <p className="whitespace-pre-wrap text-sm leading-6">{payload?.prompt}</p>
        {payload?.reasoning && <p className="text-xs" style={{ color: 'var(--muted)' }}>{payload.reasoning}</p>}
        <Button size="sm" onClick={() => onGenerateImage?.({ promptOverride: payload?.prompt })}>
          生成图片
        </Button>
      </div>
    );
  }

  if (messageType === 'edit_suggestion') {
    const sourceImages = payload?.sourceImages ?? [];
    return (
      <div className="rounded-lg p-4 space-y-3" style={{ border: '1px solid var(--border)', backgroundColor: 'var(--panel)' }}>
        <div className="text-xs font-medium" style={{ color: 'var(--muted)' }}>编辑建议</div>
        {sourceImages.length > 0 && (
          <div className="flex gap-2 overflow-x-auto">
            {sourceImages.map((image: any, index: number) => (
              <img key={`${image.url}-${index}`} src={image.url} alt="" className="h-16 w-16 rounded object-cover" />
            ))}
          </div>
        )}
        <p className="whitespace-pre-wrap text-sm leading-6">{payload?.instruction}</p>
        {payload?.reasoning && <p className="text-xs" style={{ color: 'var(--muted)' }}>{payload.reasoning}</p>}
        <Button
          size="sm"
          onClick={() => onGenerateImage?.({
            editInstruction: payload?.instruction,
            sourceImages,
          })}
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
      <div className="rounded-lg p-4 space-y-3" style={{ border: '1px solid var(--border)', backgroundColor: 'var(--panel)' }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium" style={{ color: 'var(--muted)' }}>图片结果</div>
            <div className="text-[11px]" style={{ color: 'var(--muted)' }}>{payload?.model}</div>
          </div>
          <Button size="sm" variant="outline" onClick={() => onGenerateImage?.({ promptOverride: payload?.prompt, sourceImages })}>
            重新生成
          </Button>
        </div>
        {payload?.prompt && (
          <p className="rounded-md p-2 text-xs leading-5" style={{ backgroundColor: 'var(--panel-muted)', color: 'var(--foreground)' }}>
            {payload.prompt}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          {images.map((source, index) => {
            return (
              <div key={`${source.url}-${index}`} className="relative overflow-hidden rounded-lg">
                <img src={source.url} alt="" className="aspect-square w-full rounded-lg object-cover" />
                <button
                  type="button"
                  className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/70"
                  onClick={() => onSelectSourceImage?.(source)}
                >
                  编辑
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (messageType === 'image_generating' || messageType === 'image_editing') {
    return (
      <div className="rounded-lg p-4 text-sm" style={{ border: '1px solid var(--border)', backgroundColor: 'var(--panel)' }}>
        {messageType === 'image_editing' ? '正在编辑图片...' : '正在生成图片...'}
      </div>
    );
  }

  return null;
}

export function MessageBubble({ role, content, thinking, isStreaming, messageType, payload, onGenerateImage, onSelectSourceImage }: MessageBubbleProps) {
  const isUser = role === 'user';
  const [liked, setLiked] = useState(false);
  const t = useTranslations('chat');
  const shouldRenderWorkflowCard =
    !isUser &&
    (
      messageType === 'prompt_suggestion' ||
      messageType === 'edit_suggestion' ||
      messageType === 'image_result' ||
      messageType === 'image_generating' ||
      messageType === 'image_editing'
    );

  return (
    <div className={`flex w-full flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}>
      {role === 'assistant' && thinking && (
        <div
          className="w-full max-w-[720px] rounded-md px-4 py-3"
          style={{
            backgroundColor: 'var(--chat-thinking-bg)',
            border: '1px solid var(--border)',
            color: 'var(--muted)',
          }}
        >
          <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.16em]">
            {t('thinking')}
          </div>
          <div className="whitespace-pre-wrap text-sm leading-6">{thinking}</div>
        </div>
      )}

      <div
        className={isUser ? 'max-w-[78%]' : 'w-full max-w-[720px]'}
        style={
          isUser
            ? {
                width: 'fit-content',
                backgroundColor: 'var(--chat-user-bubble)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '12px 14px',
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
              }
            : {
                color: 'var(--foreground)',
              }
        }
      >
        {shouldRenderWorkflowCard ? (
          <ImageWorkflowCard
            messageType={messageType}
            payload={payload}
            onGenerateImage={onGenerateImage}
            onSelectSourceImage={onSelectSourceImage}
          />
        ) : content === '' && isStreaming ? (
          <span className="flex items-center gap-1 py-2">
            <span
              className="h-1.5 w-1.5 rounded-full animate-bounce"
              style={{ backgroundColor: 'var(--foreground)', animationDelay: '0ms' }}
            />
            <span
              className="h-1.5 w-1.5 rounded-full animate-bounce"
              style={{ backgroundColor: 'var(--foreground)', animationDelay: '150ms' }}
            />
            <span
              className="h-1.5 w-1.5 rounded-full animate-bounce"
              style={{ backgroundColor: 'var(--foreground)', animationDelay: '300ms' }}
            />
          </span>
        ) : isUser ? (
          <p className="whitespace-pre-wrap text-[15px] leading-7">{content}</p>
        ) : (
          <div className="max-w-none text-[15px] leading-7 prose-assistant">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => (
                  <p className="mb-4 last:mb-0" style={{ color: 'var(--foreground)' }}>
                    {children}
                  </p>
                ),
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const codeStr = String(children).replace(/\n$/, '');
                  if (match) {
                    return <CodeBlock language={match[1]}>{codeStr}</CodeBlock>;
                  }
                  return (
                    <code
                      className="rounded px-1.5 py-0.5 text-[12px] font-mono"
                      style={{ backgroundColor: 'var(--panel-muted)', color: 'var(--foreground)' }}
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
                h1: ({ children }) => (
                  <h1 className="mb-3 mt-6 text-[1.4rem] font-semibold first:mt-0" style={{ color: 'var(--foreground)' }}>
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="mb-3 mt-6 text-[1.15rem] font-semibold first:mt-0" style={{ color: 'var(--foreground)' }}>
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="mb-2 mt-5 text-base font-semibold first:mt-0" style={{ color: 'var(--foreground)' }}>
                    {children}
                  </h3>
                ),
                ul: ({ children }) => (
                  <ul className="mb-4 list-disc space-y-1.5 pl-5" style={{ color: 'var(--foreground)' }}>
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="mb-4 list-decimal space-y-1.5 pl-5" style={{ color: 'var(--foreground)' }}>
                    {children}
                  </ol>
                ),
                li: ({ children }) => <li className="leading-7">{children}</li>,
                blockquote: ({ children }) => (
                  <blockquote
                    className="my-4 pl-4 italic"
                    style={{
                      borderLeft: '2px solid var(--border-strong)',
                      color: 'var(--muted)',
                    }}
                  >
                    {children}
                  </blockquote>
                ),
                hr: () => <hr className="my-5" style={{ borderColor: 'var(--border)' }} />,
                table: ({ children }) => (
                  <div className="my-4 overflow-x-auto rounded-md" style={{ border: '1px solid var(--border)' }}>
                    <table className="min-w-full text-sm" style={{ borderCollapse: 'collapse', backgroundColor: 'var(--panel)' }}>
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children }) => (
                  <th
                    className="px-3 py-2 text-left text-xs font-semibold"
                    style={{
                      backgroundColor: 'var(--panel-muted)',
                      borderBottom: '1px solid var(--border)',
                      color: 'var(--foreground)',
                    }}
                  >
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td
                    className="px-3 py-2 text-sm"
                    style={{ borderTop: '1px solid var(--border)', color: 'var(--foreground)' }}
                  >
                    {children}
                  </td>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-4"
                    style={{ color: 'var(--foreground)' }}
                  >
                    {children}
                  </a>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold" style={{ color: 'var(--foreground)' }}>
                    {children}
                  </strong>
                ),
                em: ({ children }) => (
                  <em className="italic" style={{ color: 'var(--foreground)' }}>
                    {children}
                  </em>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
            {isStreaming && (
              <span
                className="ml-1 inline-block h-4 w-0.5 animate-pulse align-middle"
                style={{ backgroundColor: 'var(--foreground)' }}
              />
            )}
          </div>
        )}
      </div>

      {!isUser && content && !isStreaming && (
        <div className="flex items-center gap-1 px-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 min-w-8 p-0 rounded-full cursor-pointer"
            onClick={() => setLiked((value) => !value)}
            aria-label={t('like')}
          >
            <ThumbsUp
              className="h-3.5 w-3.5"
              style={{ color: liked ? 'var(--foreground)' : 'var(--muted)' }}
            />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 min-w-8 p-0 rounded-full cursor-pointer"
            aria-label={t('moreOptions')}
          >
            <MoreHorizontal className="h-3.5 w-3.5" style={{ color: 'var(--muted)' }} />
          </Button>
        </div>
      )}
    </div>
  );
}
