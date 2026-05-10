'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function DocArticle({ content }: { content: string }) {
  return (
    <article className="doc-article">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      <style>{`
        .doc-article {
          line-height: 1.75;
        }
        .doc-article h1 {
          font-size: 1.875rem;
          font-weight: 700;
          margin-bottom: 0.75rem;
          color: var(--foreground);
          letter-spacing: -0.015em;
        }
        .doc-article h2 {
          font-size: 1.35rem;
          font-weight: 600;
          margin-top: 2.5rem;
          margin-bottom: 0.75rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid var(--border);
          color: var(--foreground);
        }
        .doc-article h3 {
          font-size: 1.05rem;
          font-weight: 600;
          margin-top: 1.5rem;
          margin-bottom: 0.5rem;
          color: var(--foreground);
        }
        .doc-article p {
          margin-bottom: 1rem;
          color: var(--muted-foreground);
          font-size: 0.875rem;
        }
        .doc-article ul, .doc-article ol {
          margin-bottom: 1rem;
          padding-left: 1.5rem;
          color: var(--muted-foreground);
          font-size: 0.875rem;
        }
        .doc-article li {
          margin-bottom: 0.35rem;
        }
        .doc-article strong {
          color: var(--foreground);
          font-weight: 600;
        }
        .doc-article code {
          font-size: 0.8rem;
          padding: 0.15rem 0.4rem;
          border-radius: 4px;
          background-color: var(--secondary);
          color: var(--primary);
          font-family: 'SF Mono', 'Fira Code', monospace;
        }
        .doc-article pre {
          margin-bottom: 1rem;
          border-radius: 0.75rem;
          overflow-x: auto;
          padding: 1rem;
          background-color: var(--secondary) !important;
          border: 1px solid var(--border);
        }
        .doc-article pre code {
          background: none;
          padding: 0;
          color: var(--foreground);
          font-size: 0.8rem;
        }
        .doc-article table {
          width: 100%;
          margin-bottom: 1rem;
          border-collapse: collapse;
          font-size: 0.8rem;
        }
        .doc-article th {
          text-align: left;
          padding: 0.5rem 0.75rem;
          font-weight: 600;
          color: var(--foreground);
          background-color: var(--secondary);
          border-bottom: 2px solid var(--border);
        }
        .doc-article td {
          padding: 0.5rem 0.75rem;
          color: var(--muted-foreground);
          border-bottom: 1px solid var(--border);
        }
        .doc-article a {
          color: var(--primary);
          text-decoration: none;
        }
        .doc-article a:hover {
          text-decoration: underline;
        }
        .doc-article blockquote {
          border-left: 3px solid var(--primary);
          padding-left: 1rem;
          margin-bottom: 1rem;
          color: var(--muted-foreground);
          font-size: 0.875rem;
        }
        .doc-article hr {
          margin: 2rem 0;
          border: none;
          border-top: 1px solid var(--border);
        }
      `}</style>
    </article>
  );
}
