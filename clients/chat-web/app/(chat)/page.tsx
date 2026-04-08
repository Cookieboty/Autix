'use client';

import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '@/store/chat.store';
import { MessageSquare, Globe, ChevronDown } from 'lucide-react';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { ChatInput } from '@/components/chat/ChatInput';

const CHAT_API_URL = process.env.NEXT_PUBLIC_CHAT_API_URL || 'http://localhost:4001';

const MODELS = [
  { id: 'llama-4-maverick', label: 'Llama-4-Maverick' },
  { id: 'llama-4-scout', label: 'Llama-4-Scout' },
  { id: 'gpt-4o', label: 'GPT-4o' },
  { id: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' },
];

function ModelSelector() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(MODELS[0]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
        style={{
          backgroundColor: open ? 'var(--surface)' : 'transparent',
          color: 'var(--foreground)',
          border: '1px solid var(--border)',
        }}
        onMouseEnter={(e) => {
          if (!open) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface)';
        }}
        onMouseLeave={(e) => {
          if (!open) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
        }}
      >
        <Globe className="w-4 h-4" style={{ color: 'var(--muted)' }} />
        <span>{selected.label}</span>
        <ChevronDown
          className="w-3.5 h-3.5 transition-transform"
          style={{
            color: 'var(--muted)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 w-48 rounded-xl py-1 z-50 shadow-lg"
          style={{
            backgroundColor: 'var(--overlay)',
            border: '1px solid var(--border)',
          }}
        >
          {MODELS.map((model) => (
            <button
              key={model.id}
              onClick={() => {
                setSelected(model);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors cursor-pointer"
              style={{
                color: selected.id === model.id ? 'var(--accent)' : 'var(--foreground)',
                backgroundColor: 'transparent',
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface)')
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')
              }
            >
              <Globe className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--muted)' }} />
              {model.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  const {
    sessions,
    activeSessionId,
    createSession,
    setActiveSession,
    addMessage,
    appendToLastAssistantMessage,
    setStreaming,
    isStreaming,
    getActiveSession,
  } = useChatStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const activeSession = getActiveSession();

  useEffect(() => {
    if (!activeSessionId && sessions.length === 0) {
      const id = createSession();
      setActiveSession(id);
    } else if (!activeSessionId && sessions.length > 0) {
      setActiveSession(sessions[0].id);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages]);

  const handleSend = async (content: string) => {
    if (!activeSessionId) return;

    addMessage(activeSessionId, {
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    });

    addMessage(activeSessionId, {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    });

    setStreaming(true);
    abortRef.current = new AbortController();

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
      const response = await fetch(`${CHAT_API_URL}/chat/langchain/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ input: content }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          appendToLastAssistantMessage(activeSessionId, chunk);
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        appendToLastAssistantMessage(activeSessionId, '\n\n*[请求出错，请重试]*');
      }
    } finally {
      setStreaming(false);
    }
  };

  if (!activeSession) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--muted)' }}>
        <div className="text-center space-y-3">
          <MessageSquare className="w-12 h-12 mx-auto opacity-30" />
          <p className="text-sm">选择或创建一个对话开始</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--background)' }}>
      {/* Header with left-aligned model selector */}
      <div
        className="flex items-center flex-shrink-0 h-14"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="w-full max-w-3xl mx-auto px-8">
          <ModelSelector />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-8">
        <div className="max-w-3xl mx-auto px-8 space-y-8">
          {activeSession.messages.length === 0 && (
            <MessageBubble
              role="assistant"
              content={`您好！我是 Autix AI 需求分析助理。\n请描述您的需求，我来帮您进行结构化分析与整理。`}
            />
          )}

          {activeSession.messages.map((msg, i) => (
            <MessageBubble
              key={msg.id}
              role={msg.role}
              content={msg.content}
              isStreaming={isStreaming && i === activeSession.messages.length - 1 && msg.content === ''}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 pb-5 pt-3">
        <div className="max-w-3xl mx-auto px-8">
          <ChatInput onSend={handleSend} isStreaming={isStreaming} />
        </div>
      </div>
    </div>
  );
}
