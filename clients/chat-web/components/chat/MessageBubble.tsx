'use client';

import { useState } from 'react';
import { ThumbsUp, MoreHorizontal } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

export function MessageBubble({ role, content, isStreaming }: MessageBubbleProps) {
  const isUser = role === 'user';
  const [liked, setLiked] = useState(false);

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-1`}>
      <div
        className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser ? 'max-w-[70%] rounded-tr-sm' : 'max-w-[85%] rounded-tl-sm'
        }`}
        style={
          isUser
            ? {
                backgroundColor: 'var(--surface)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
              }
            : {
                backgroundColor: 'transparent',
                color: 'var(--foreground)',
              }
        }
      >
        {content === '' && isStreaming ? (
          <span className="flex items-center gap-1 py-1">
            <span
              className="w-1.5 h-1.5 rounded-full animate-bounce"
              style={{ backgroundColor: 'var(--accent)', animationDelay: '0ms' }}
            />
            <span
              className="w-1.5 h-1.5 rounded-full animate-bounce"
              style={{ backgroundColor: 'var(--accent)', animationDelay: '150ms' }}
            />
            <span
              className="w-1.5 h-1.5 rounded-full animate-bounce"
              style={{ backgroundColor: 'var(--accent)', animationDelay: '300ms' }}
            />
          </span>
        ) : isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="prose prose-sm max-w-none" style={{ color: 'var(--foreground)' }}>
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                code: ({ children, className }) => {
                  const isBlock = className?.includes('language-');
                  return isBlock ? (
                    <code
                      className={`block rounded-lg px-4 py-3 text-xs overflow-x-auto my-3 ${className}`}
                      style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
                    >
                      {children}
                    </code>
                  ) : (
                    <code
                      className="rounded px-1.5 py-0.5 text-xs"
                      style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
                    >
                      {children}
                    </code>
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>
            {isStreaming && (
              <span
                className="inline-block w-0.5 h-4 animate-pulse ml-0.5 align-middle"
                style={{ backgroundColor: 'var(--accent)' }}
              />
            )}
          </div>
        )}
      </div>

      {/* Reaction buttons — only for assistant messages */}
      {!isUser && content && !isStreaming && (
        <div className="flex items-center gap-1 px-1">
          <button
            onClick={() => setLiked((v) => !v)}
            className="p-1.5 rounded-md transition-colors cursor-pointer"
            style={{ color: liked ? 'var(--accent)' : 'var(--muted)' }}
            onMouseEnter={(e) => {
              if (!liked) (e.currentTarget as HTMLElement).style.color = 'var(--foreground)';
            }}
            onMouseLeave={(e) => {
              if (!liked) (e.currentTarget as HTMLElement).style.color = 'var(--muted)';
            }}
            title="Like"
          >
            <ThumbsUp className="w-3.5 h-3.5" />
          </button>
          <button
            className="p-1.5 rounded-md transition-colors cursor-pointer"
            style={{ color: 'var(--muted)' }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.color = 'var(--foreground)')
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.color = 'var(--muted)')
            }
            title="More options"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
