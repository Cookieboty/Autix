'use client';

import { useState } from 'react';
import { Paperclip, Globe, ChevronDown, ArrowUp, Loader2 } from 'lucide-react';
import { TextArea, Button } from '@heroui/react';

interface ChatInputProps {
  onSend: (content: string) => void;
  isStreaming: boolean;
}

export function ChatInput({ onSend, isStreaming }: ChatInputProps) {
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    onSend(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = !!input.trim() && !isStreaming;

  return (
    <div className="flex flex-col gap-2">
      <div
        className="overflow-hidden rounded-lg"
        style={{
          backgroundColor: 'var(--panel)',
          border: '1px solid var(--input-border)',
        }}
      >
        <div className="px-5 pt-4 pb-2">
          <div
            className="rounded-md px-1"
            style={{ backgroundColor: 'transparent' }}
          >
            <TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              aria-label="消息输入框"
              placeholder="给 Claude 风格工作台输入你的需求…"
              disabled={isStreaming}
              className="w-full resize-none bg-transparent text-[15px] leading-7 text-[var(--foreground)] placeholder:text-[var(--muted)] outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between px-4 pb-4 pt-1">
          <div className="flex items-center gap-2">
            <Button
              isIconOnly
              variant="ghost"
              size="sm"
              className="h-9 min-w-9 rounded-full cursor-pointer"
              isDisabled
              aria-label="Attach file"
              style={{ color: 'var(--muted)' }}
            >
              <Paperclip className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-9 rounded-full px-3 text-xs font-medium cursor-pointer"
              style={{
                backgroundColor: 'var(--panel-muted)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
              }}
            >
              <Globe className="mr-1.5 h-3.5 w-3.5" style={{ color: 'var(--muted)' }} />
              Deep Search
              <ChevronDown className="ml-1 h-3 w-3" style={{ color: 'var(--muted)' }} />
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
              ⌘/Ctrl + Enter 发送
            </span>
            <Button
              isIconOnly
              onPress={handleSend}
              isDisabled={!canSend}
              aria-label={isStreaming ? '正在生成回复' : '发送消息'}
              className="h-10 w-10 min-w-10 rounded-full cursor-pointer transition-opacity"
              style={{
                backgroundColor: canSend ? 'var(--foreground)' : 'var(--surface-tertiary)',
                color: canSend ? 'var(--panel)' : 'var(--muted)',
                opacity: canSend ? 1 : 0.7,
              }}
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
