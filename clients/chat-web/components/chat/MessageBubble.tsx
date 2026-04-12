'use client';

import { useState } from 'react';
import { ThumbsUp, MoreHorizontal, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

function CodeBlock({ language, children }: { language: string; children: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="relative my-3 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-4 py-2 text-xs"
        style={{ backgroundColor: 'var(--surface)', color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}
      >
        <span>{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 transition-colors cursor-pointer"
          style={{ color: copied ? 'var(--accent)' : 'var(--muted)' }}
          onMouseEnter={(e) => {
            if (!copied) (e.currentTarget as HTMLElement).style.color = 'var(--foreground)';
          }}
          onMouseLeave={(e) => {
            if (!copied) (e.currentTarget as HTMLElement).style.color = 'var(--muted)';
          }}
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={oneDark}
        customStyle={{
          margin: 0,
          borderRadius: 0,
          fontSize: '0.8rem',
          lineHeight: '1.6',
          padding: '1rem',
        }}
        showLineNumbers={children.split('\n').length > 5}
        lineNumberStyle={{ color: '#555', fontSize: '0.75rem', minWidth: '2.5rem' }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
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
          <div className="max-w-none text-sm leading-relaxed prose-assistant">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // 段落
                p: ({ children }) => (
                  <p className="mb-3 last:mb-0" style={{ color: 'var(--foreground)' }}>
                    {children}
                  </p>
                ),
                // 代码块 vs 行内代码
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const codeStr = String(children).replace(/\n$/, '');
                  if (match) {
                    return <CodeBlock language={match[1]}>{codeStr}</CodeBlock>;
                  }
                  return (
                    <code
                      className="rounded px-1.5 py-0.5 text-xs font-mono"
                      style={{ backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
                // 标题
                h1: ({ children }) => (
                  <h1 className="text-xl font-bold mt-4 mb-2 first:mt-0" style={{ color: 'var(--foreground)' }}>{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-lg font-semibold mt-4 mb-2 first:mt-0" style={{ color: 'var(--foreground)' }}>{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-base font-semibold mt-3 mb-1.5 first:mt-0" style={{ color: 'var(--foreground)' }}>{children}</h3>
                ),
                // 列表
                ul: ({ children }) => (
                  <ul className="list-disc list-outside pl-5 mb-3 space-y-1" style={{ color: 'var(--foreground)' }}>{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-outside pl-5 mb-3 space-y-1" style={{ color: 'var(--foreground)' }}>{children}</ol>
                ),
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                // 引用块
                blockquote: ({ children }) => (
                  <blockquote
                    className="pl-4 my-3 italic"
                    style={{
                      borderLeft: '3px solid var(--accent)',
                      color: 'var(--muted)',
                    }}
                  >
                    {children}
                  </blockquote>
                ),
                // 分割线
                hr: () => <hr className="my-4" style={{ borderColor: 'var(--border)' }} />,
                // 表格
                table: ({ children }) => (
                  <div className="overflow-x-auto my-3">
                    <table className="min-w-full text-xs" style={{ borderCollapse: 'collapse' }}>{children}</table>
                  </div>
                ),
                th: ({ children }) => (
                  <th
                    className="px-3 py-2 text-left font-semibold text-xs"
                    style={{
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--border)',
                      color: 'var(--foreground)',
                    }}
                  >
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td
                    className="px-3 py-2 text-xs"
                    style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
                  >
                    {children}
                  </td>
                ),
                // 链接
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2"
                    style={{ color: 'var(--accent)' }}
                  >
                    {children}
                  </a>
                ),
                // 加粗 / 斜体
                strong: ({ children }) => (
                  <strong className="font-semibold" style={{ color: 'var(--foreground)' }}>{children}</strong>
                ),
                em: ({ children }) => (
                  <em className="italic" style={{ color: 'var(--foreground)' }}>{children}</em>
                ),
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
