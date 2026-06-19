'use client';

import { lazy, Suspense } from 'react';
import type { ComponentType } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { UIText } from '@autix/shared-store';

interface TextMessageProps extends UIText {}

const LazySyntaxHighlighter = lazy(async () => {
  const [{ Prism }, styles] = await Promise.all([
    import('react-syntax-highlighter'),
    import('react-syntax-highlighter/dist/esm/styles/prism'),
  ]);
  const Component = Prism as ComponentType<any>;

  function SyntaxHighlighterLoader(props: { children: string; language: string }) {
    return <Component style={styles.vscDarkPlus} PreTag="div" {...props} />;
  }

  return { default: SyntaxHighlighterLoader };
});

export function TextMessage({ content }: TextMessageProps) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
              <Suspense
                fallback={
                  <pre className="overflow-x-auto rounded-md bg-secondary p-3 text-sm">
                    <code>{String(children).replace(/\n$/, '')}</code>
                  </pre>
                }
              >
                <LazySyntaxHighlighter language={match[1]} {...props}>
                  {String(children).replace(/\n$/, '')}
                </LazySyntaxHighlighter>
              </Suspense>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
