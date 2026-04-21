'use client';

import { useState } from 'react';
import { ThumbsUp, MoreHorizontal, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Button } from '@heroui/react';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  isStreaming?: boolean;
}

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
          onPress={handleCopy}
          style={{ color: copied ? 'var(--foreground)' : 'var(--muted)' }}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? '已复制' : '复制'}
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

export function MessageBubble({ role, content, thinking, isStreaming }: MessageBubbleProps) {
  const isUser = role === 'user';
  const [liked, setLiked] = useState(false);

  return (
    <div className={`flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}>
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
            Thinking
          </div>
          <div className="whitespace-pre-wrap text-sm leading-6">{thinking}</div>
        </div>
      )}

      <div
        className={isUser ? 'max-w-[78%]' : 'w-full max-w-[720px]'}
        style={
          isUser
            ? {
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
        {content === '' && isStreaming ? (
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
            isIconOnly
            size="sm"
            variant="ghost"
            className="h-8 min-w-8 rounded-full cursor-pointer"
            onPress={() => setLiked((value) => !value)}
            aria-label="Like"
          >
            <ThumbsUp
              className="h-3.5 w-3.5"
              style={{ color: liked ? 'var(--foreground)' : 'var(--muted)' }}
            />
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            className="h-8 min-w-8 rounded-full cursor-pointer"
            aria-label="More options"
          >
            <MoreHorizontal className="h-3.5 w-3.5" style={{ color: 'var(--muted)' }} />
          </Button>
        </div>
      )}
    </div>
  );
}
