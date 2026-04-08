'use client';

import { useState } from 'react';
import { Paperclip, Globe, ChevronDown, ArrowUp, Loader2 } from 'lucide-react';

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
    <div className="flex flex-col gap-1">
      {/* Input card */}
      <div
        className="rounded-2xl overflow-hidden transition-colors"
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
        }}
        onFocusCapture={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
        }}
      >
        {/* Textarea row */}
        <div className="px-4 pt-3 pb-1">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What do you want to know?"
            rows={1}
            disabled={isStreaming}
            className="w-full resize-none bg-transparent text-sm outline-none min-h-[28px] max-h-[160px] py-0.5 disabled:opacity-50"
            style={{
              color: 'var(--foreground)',
              lineHeight: '1.6',
            }}
            onInput={(e) => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = 'auto';
              t.style.height = Math.min(t.scrollHeight, 160) + 'px';
            }}
          />
        </div>

        {/* Toolbar row */}
        <div className="flex items-center justify-between px-3 pb-3 pt-1">
          {/* Left tools */}
          <div className="flex items-center gap-1">
            {/* Attach button */}
            <button
              className="p-1.5 rounded-lg transition-colors cursor-pointer"
              style={{ color: 'var(--muted)' }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.color = 'var(--foreground)')
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.color = 'var(--muted)')
              }
              title="Attach file"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Deep Search button */}
            <button
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              style={{
                color: 'var(--foreground)',
                backgroundColor: 'var(--surface-secondary)',
                border: '1px solid var(--border)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-tertiary)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-secondary)';
              }}
            >
              <Globe className="w-3.5 h-3.5" style={{ color: 'var(--muted)' }} />
              <span>Deep Search</span>
              <ChevronDown className="w-3 h-3" style={{ color: 'var(--muted)' }} />
            </button>
          </div>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: canSend ? 'var(--accent)' : 'var(--surface-tertiary)',
              color: 'var(--accent-foreground)',
            }}
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowUp className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-center text-xs py-1" style={{ color: 'var(--muted)' }}>
        AI can make mistakes. Check important info.
      </p>
    </div>
  );
}
