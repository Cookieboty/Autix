'use client';

import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';

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

  return (
    <div className="flex items-end gap-3 rounded-2xl p-3 bg-secondary border border-border">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="描述您的需求... (Ctrl+Enter 发送)"
        rows={1}
        disabled={isStreaming}
        className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-foreground/30 outline-none min-h-[24px] max-h-[144px] py-1 disabled:opacity-50"
        style={{ lineHeight: '1.6' }}
        onInput={(e) => {
          const t = e.target as HTMLTextAreaElement;
          t.style.height = 'auto';
          t.style.height = Math.min(t.scrollHeight, 144) + 'px';
        }}
      />
      <button
        onClick={handleSend}
        disabled={!input.trim() || isStreaming}
        className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-success text-success-foreground hover:bg-success/90"
      >
        {isStreaming ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}
