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
    <div className="flex flex-col gap-1">
      {/* Input card */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
        }}
      >
        {/* TextArea row */}
        <div className="px-4 pt-3 pb-1">
          <TextArea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What do you want to know?"
            disabled={isStreaming}
            className="w-full resize-none bg-transparent"
          />
        </div>

        {/* Toolbar row */}
        <div className="flex items-center justify-between px-3 pb-3 pt-1">
          {/* Left tools */}
          <div className="flex items-center gap-1">
            {/* Attach button */}
            <Button
              isIconOnly
              variant="ghost"
              size="sm"
              className="cursor-pointer min-w-8 h-8"
              isDisabled
              aria-label="Attach file"
            >
              <Paperclip className="w-4 h-4" style={{ color: 'var(--muted)' }} />
            </Button>

            {/* Deep Search button */}
            <Button
              variant="ghost"
              size="sm"
              className="cursor-pointer h-8 text-xs font-medium"
              style={{
                backgroundColor: 'var(--surface-secondary)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
              }}
            >
              <Globe className="w-3.5 h-3.5 mr-1" style={{ color: 'var(--muted)' }} />
              Deep Search
              <ChevronDown className="w-3 h-3 ml-1" style={{ color: 'var(--muted)' }} />
            </Button>
          </div>

          {/* Send button */}
          <Button
            isIconOnly
            onPress={handleSend}
            isDisabled={!canSend}
            className={`w-8 h-8 rounded-full cursor-pointer ${
              canSend ? '' : 'opacity-40'
            }`}
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
          </Button>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-center text-xs py-1" style={{ color: 'var(--muted)' }}>
        AI can make mistakes. Check important info.
      </p>
    </div>
  );
}
