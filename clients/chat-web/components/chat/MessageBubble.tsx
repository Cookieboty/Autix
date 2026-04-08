'use client';

import { Avatar } from '@heroui/react';
import { Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

export function MessageBubble({ role, content, isStreaming }: MessageBubbleProps) {
  const isUser = role === 'user';

  return (
    <div className={`flex items-start gap-4 ${isUser ? 'flex-row-reverse' : ''}`}>
      <Avatar
        size="sm"
        className={isUser ? 'bg-success/20 text-success' : 'bg-primary/40 text-foreground/60'}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </Avatar>
      <div
        className={`rounded-2xl px-5 py-4 max-w-2xl text-sm leading-relaxed ${
          isUser ? 'rounded-tr-none bg-success/15 border border-success/25 text-success-foreground/90' : 'rounded-tl-none bg-secondary border border-border text-foreground/85'
        }`}
      >
        {content === '' && isStreaming ? (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        ) : isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="text-foreground/85">
            <ReactMarkdown>{content}</ReactMarkdown>
            {isStreaming && (
              <span className="inline-block w-0.5 h-4 bg-primary animate-pulse ml-0.5" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
