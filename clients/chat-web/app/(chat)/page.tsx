'use client';

import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '@/store/chat.store';
import ReactMarkdown from 'react-markdown';
import { Send, Bot, User, Loader2, MessageSquare } from 'lucide-react';

const CHAT_API_URL = process.env.NEXT_PUBLIC_CHAT_API_URL || 'http://localhost:4001';

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

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const activeSession = getActiveSession();

  // Auto-create session on mount if none
  useEffect(() => {
    if (!activeSessionId && sessions.length === 0) {
      const id = createSession();
      setActiveSession(id);
    } else if (!activeSessionId && sessions.length > 0) {
      setActiveSession(sessions[0].id);
    }
  }, []);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming || !activeSessionId) return;

    const content = input.trim();
    setInput('');

    // Add user message
    addMessage(activeSessionId, {
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    });

    // Add empty assistant message (will be filled by stream)
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!activeSession) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ color: 'rgba(165,180,252,0.4)' }}>
        <div className="text-center space-y-3">
          <MessageSquare className="w-12 h-12 mx-auto opacity-30" />
          <p className="text-sm">选择或创建一个对话开始</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center px-6 h-14 border-b flex-shrink-0"
        style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(26,26,46,0.8)' }}
      >
        <h2 className="text-sm font-medium text-white truncate">{activeSession.title}</h2>
        <span className="ml-3 text-xs px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(67,56,202,0.3)', color: 'rgba(165,180,252,0.8)' }}>
          需求分析模式
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {activeSession.messages.length === 0 && (
          <div className="flex items-start gap-4 max-w-3xl">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(67,56,202,0.4)' }}>
              <Bot className="w-4 h-4 text-indigo-300" />
            </div>
            <div className="rounded-2xl rounded-tl-none px-5 py-4 max-w-2xl"
              style={{ background: 'rgba(30,27,75,0.6)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <p className="text-sm text-indigo-100/80">
                您好！我是 Autix AI 需求分析助理。
                <br />请描述您的需求，我来帮您进行结构化分析与整理。
                <br /><span className="text-xs text-indigo-300/50 mt-2 block">
                  提示：Ctrl+Enter 发送消息
                </span>
              </p>
            </div>
          </div>
        )}

        {activeSession.messages.map((msg, i) => (
          <div
            key={msg.id}
            className={`flex items-start gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                background: msg.role === 'user'
                  ? 'rgba(34,197,94,0.2)'
                  : 'rgba(67,56,202,0.4)',
              }}
            >
              {msg.role === 'user'
                ? <User className="w-4 h-4 text-green-400" />
                : <Bot className="w-4 h-4 text-indigo-300" />
              }
            </div>
            <div
              className={`rounded-2xl px-5 py-4 max-w-2xl text-sm leading-relaxed ${
                msg.role === 'user' ? 'rounded-tr-none' : 'rounded-tl-none'
              }`}
              style={{
                background: msg.role === 'user'
                  ? 'rgba(34,197,94,0.15)'
                  : 'rgba(30,27,75,0.6)',
                border: msg.role === 'user'
                  ? '1px solid rgba(34,197,94,0.25)'
                  : '1px solid rgba(99,102,241,0.2)',
                color: msg.role === 'user' ? 'rgba(187,247,208,0.9)' : 'rgba(224,231,255,0.85)',
              }}
            >
              {msg.content === '' && isStreaming && i === activeSession.messages.length - 1 ? (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              ) : msg.role === 'assistant' ? (
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                  {isStreaming && i === activeSession.messages.length - 1 && (
                    <span className="inline-block w-0.5 h-4 bg-indigo-400 animate-pulse ml-0.5" />
                  )}
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div
        className="flex-shrink-0 px-6 pb-6 pt-4 border-t"
        style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(15,15,35,0.8)' }}
      >
        <div
          className="flex items-end gap-3 rounded-2xl p-3"
          style={{ background: 'rgba(30,27,75,0.6)', border: '1px solid rgba(99,102,241,0.25)' }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="描述您的需求... (Ctrl+Enter 发送)"
            rows={1}
            disabled={isStreaming}
            className="flex-1 resize-none bg-transparent text-sm text-indigo-100 placeholder:text-indigo-300/30 outline-none min-h-[24px] max-h-[144px] py-1 disabled:opacity-50"
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
            className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: '#22C55E' }}
            onMouseEnter={(e) => !isStreaming && (e.currentTarget.style.background = '#16a34a')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#22C55E')}
          >
            {isStreaming
              ? <Loader2 className="w-4 h-4 text-black animate-spin" />
              : <Send className="w-4 h-4 text-black" />
            }
          </button>
        </div>
      </div>
    </div>
  );
}
