'use client';

import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { conversationActions } from '@autix/shared-store';

interface DirectorMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface AIDirectorChatProps {
  conversationId: string;
  onSend?: (message: string) => void;
  onDone?: () => void;
}

export function AIDirectorChat({ conversationId, onSend, onDone }: AIDirectorChatProps) {
  const t = useTranslations('videoWorkbench.legacy.directorChat');
  const [messages, setMessages] = useState<DirectorMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || streaming) return;

    if (onSend) {
      onSend(text);
    }

    const userMsg: DirectorMessage = { id: `u-${Date.now()}`, role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setStreaming(true);

    const assistantId = `a-${Date.now()}`;
    setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

    abortRef.current = new AbortController();

    try {
      await conversationActions.streamConversationChat(conversationId, {
        body: { message: text },
        signal: abortRef.current.signal,
        onmessage(event) {
          try {
            const msg = JSON.parse(event.data);
            if (msg.messageType === 'markdown' && msg.payload?.content) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + msg.payload.content }
                    : m,
                ),
              );
            }
            if (msg.messageType === 'done') {
              setStreaming(false);
              onDone?.();
            }
          } catch {
            /* skip parse errors */
          }
        },
        onerror() {
          setStreaming(false);
          throw new Error('sse-closed');
        },
        openWhenHidden: false,
        async onopen(response) {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
        },
      });
    } catch {
      setStreaming(false);
    }
  };

  return (
    <div className="border-t border-border bg-background">
      {messages.length > 0 && (
        <div ref={scrollRef} className="max-h-44 overflow-y-auto px-4 py-2 space-y-2">
          {messages.slice(-6).map((msg) => (
            <div
              key={msg.id}
              className={`whitespace-pre-wrap text-xs leading-5 ${msg.role === 'user' ? 'text-foreground' : 'text-muted-foreground'}`}
            >
              <span className="font-medium">{msg.role === 'user' ? t('userPrefix') : t('aiPrefix')}</span>
              {msg.content || '...'}
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 px-4 py-2">
        <input
          type="text"
          className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder={t('placeholder')}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          disabled={streaming}
        />
        <button
          type="button"
          className="inline-flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          onClick={handleSend}
          disabled={!input.trim() || streaming}
        >
          <Send className="size-4" />
        </button>
      </div>
    </div>
  );
}
