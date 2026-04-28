'use client';

import { useState, useEffect, useRef } from 'react';
import { Copy, Check, AlertCircle, Clock, Zap } from 'lucide-react';
import { Button } from '@heroui/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { LocalArenaResponse } from '@/store/arena.store';

function CodeBlock({ language, children }: { language: string; children: string }) {
  const [copied, setCopied] = useState(false);
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
      className="relative my-3 overflow-hidden rounded-lg"
      style={{ border: '1px solid var(--border)', backgroundColor: 'var(--panel)' }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 text-xs"
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
          className="h-6 gap-1 rounded-md text-xs cursor-pointer"
          onPress={handleCopy}
          style={{ color: copied ? 'var(--foreground)' : 'var(--muted)' }}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? '已复制' : '复制'}
        </Button>
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={isDarkTheme ? oneDark : oneLight}
        customStyle={{
          margin: 0,
          borderRadius: 0,
          fontSize: '0.78rem',
          lineHeight: '1.6',
          padding: '0.75rem',
          background: 'transparent',
        }}
        showLineNumbers={children.split('\n').length > 5}
        lineNumberStyle={{ color: 'var(--muted)', fontSize: '0.7rem', minWidth: '2rem' }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
}

function ElapsedTimer({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const tick = () => {
      setElapsed(Date.now() - startTime);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [startTime]);

  return <span>{(elapsed / 1000).toFixed(1)}s</span>;
}

interface ArenaResponseCardProps {
  response: LocalArenaResponse;
}

export function ArenaResponseCard({ response }: ArenaResponseCardProps) {
  const isStreaming = response.status === 'streaming';
  const isPending = response.status === 'pending';
  const isError = response.status === 'error';
  const isCompleted = response.status === 'completed';

  return (
    <div
      className="flex flex-col h-full rounded-lg overflow-hidden"
      style={{
        border: `1px solid ${isError ? 'var(--danger, #ef4444)' : 'var(--border)'}`,
        backgroundColor: 'var(--panel)',
      }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2 flex-shrink-0"
        style={{
          backgroundColor: 'var(--panel-muted)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div
          className="h-2 w-2 rounded-full flex-shrink-0"
          style={{
            backgroundColor: isStreaming
              ? 'var(--accent, #3b82f6)'
              : isCompleted
                ? '#22c55e'
                : isError
                  ? 'var(--danger, #ef4444)'
                  : 'var(--muted)',
            animation: isStreaming ? 'pulse 1.5s infinite' : undefined,
          }}
        />
        <span className="text-xs font-medium truncate" style={{ color: 'var(--foreground)' }}>
          {response.modelName}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 min-h-0">
        {isPending && (
          <div className="flex items-center gap-1.5 py-2">
            <span
              className="h-1.5 w-1.5 rounded-full animate-bounce"
              style={{ backgroundColor: 'var(--muted)', animationDelay: '0ms' }}
            />
            <span
              className="h-1.5 w-1.5 rounded-full animate-bounce"
              style={{ backgroundColor: 'var(--muted)', animationDelay: '150ms' }}
            />
            <span
              className="h-1.5 w-1.5 rounded-full animate-bounce"
              style={{ backgroundColor: 'var(--muted)', animationDelay: '300ms' }}
            />
          </div>
        )}

        {isError && (
          <div
            className="flex items-start gap-2 rounded-md px-3 py-2 text-sm"
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', color: 'var(--danger, #ef4444)' }}
          >
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{response.error || '请求失败'}</span>
          </div>
        )}

        {(isStreaming || isCompleted) && response.responseImages.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {response.responseImages.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg overflow-hidden"
                style={{ border: '1px solid var(--border)' }}
              >
                <img
                  src={url}
                  alt={`response-image-${i}`}
                  className="max-w-full max-h-64 object-contain"
                  loading="lazy"
                />
              </a>
            ))}
          </div>
        )}

        {(isStreaming || isCompleted) && response.content && (
          <div className="max-w-none text-[14px] leading-6 prose-assistant">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => (
                  <p className="mb-3 last:mb-0" style={{ color: 'var(--foreground)' }}>{children}</p>
                ),
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const codeStr = String(children).replace(/\n$/, '');
                  if (match) return <CodeBlock language={match[1]}>{codeStr}</CodeBlock>;
                  return (
                    <code
                      className="rounded px-1 py-0.5 text-[11px] font-mono"
                      style={{ backgroundColor: 'var(--panel-muted)', color: 'var(--foreground)' }}
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
                h1: ({ children }) => (
                  <h1 className="mb-2 mt-4 text-lg font-semibold first:mt-0" style={{ color: 'var(--foreground)' }}>{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="mb-2 mt-4 text-base font-semibold first:mt-0" style={{ color: 'var(--foreground)' }}>{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className="mb-1.5 mt-3 text-sm font-semibold first:mt-0" style={{ color: 'var(--foreground)' }}>{children}</h3>
                ),
                ul: ({ children }) => (
                  <ul className="mb-3 list-disc space-y-1 pl-4" style={{ color: 'var(--foreground)' }}>{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="mb-3 list-decimal space-y-1 pl-4" style={{ color: 'var(--foreground)' }}>{children}</ol>
                ),
                li: ({ children }) => <li className="leading-6">{children}</li>,
                blockquote: ({ children }) => (
                  <blockquote
                    className="my-3 pl-3 italic"
                    style={{ borderLeft: '2px solid var(--border-strong)', color: 'var(--muted)' }}
                  >
                    {children}
                  </blockquote>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold" style={{ color: 'var(--foreground)' }}>{children}</strong>
                ),
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4" style={{ color: 'var(--foreground)' }}>
                    {children}
                  </a>
                ),
              }}
            >
              {response.content}
            </ReactMarkdown>
            {isStreaming && (
              <span
                className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse align-middle"
                style={{ backgroundColor: 'var(--foreground)' }}
              />
            )}
          </div>
        )}

        {isStreaming && !response.content && (
          <div className="flex items-center gap-1.5 py-2">
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
          </div>
        )}
      </div>

      <div
        className="flex items-center gap-3 px-3 py-2 flex-shrink-0 text-[11px]"
        style={{
          borderTop: '1px solid var(--border)',
          color: 'var(--muted)',
          backgroundColor: 'var(--panel-muted)',
        }}
      >
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {isStreaming && response.startTime ? (
            <ElapsedTimer startTime={response.startTime} />
          ) : isCompleted && response.durationMs != null ? (
            <span>{(response.durationMs / 1000).toFixed(1)}s</span>
          ) : (
            <span>--</span>
          )}
        </div>

        {isCompleted && response.totalTokens != null && (
          <div className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            <span>
              {response.totalTokens} tokens
              {response.promptTokens != null && response.completionTokens != null && (
                <span className="opacity-70">
                  {' '}({response.promptTokens} + {response.completionTokens})
                </span>
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
