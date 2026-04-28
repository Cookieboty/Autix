'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Swords, RotateCcw } from 'lucide-react';
import { Button } from '@heroui/react';
import { useArenaStore } from '@/store/arena.store';
import { ChatInput } from '@/components/chat/ChatInput';
import { ArenaModelSelector } from './ArenaModelSelector';
import { ArenaTurnGroup } from './ArenaTurnGroup';
import { fetchEventSource } from '@microsoft/fetch-event-source';

const CHAT_API_URL = process.env.NEXT_PUBLIC_CHAT_API_URL || 'http://localhost:4001';

interface ArenaViewProps {
  sessionId?: string;
}

export function ArenaView({ sessionId }: ArenaViewProps) {
  const router = useRouter();
  const {
    sessions,
    activeSessionId,
    selectedModelIds,
    isStreaming,
    isLoadingSessions,
    fetchSessions,
    createSession,
    setActiveSession,
    getActiveSession,
    setStreaming,
    clearTurns,
    addTurn,
    setResponseStreaming,
    appendToResponse,
    finalizeResponse,
    setResponseError,
    fetchAvailableModels,
  } = useArenaStore();

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const activeSession = getActiveSession();

  useEffect(() => {
    const init = async () => {
      await Promise.all([fetchSessions(), fetchAvailableModels()]);
      const state = useArenaStore.getState();
      // #endregion

      if (sessionId) {
        const exists = state.sessions.find((s) => s.id === sessionId);
        if (exists) {
          await setActiveSession(sessionId);
          return;
        }
      }

      if (!state.activeSessionId) {
        if (state.sessions.length > 0) {
          const first = state.sessions[0];
          await setActiveSession(first.id);
          router.replace(`/arena/${first.id}`);
        } else {
          const id = await createSession('新对比');
          router.replace(`/arena/${id}`);
        }
      }
    };
    init();
  }, [sessionId]);

  useEffect(() => {
    if (!activeSession?.id || activeSession.turns.length === 0) return;
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }, [activeSession?.id, activeSession?.turns.length]);

  const handleSend = async (content: string) => {
    if (!activeSessionId) return;
    if (isStreaming) return;
    if (selectedModelIds.length < 2) {
      alert('请至少选择 2 个模型进行对比');
      return;
    }

    setStreaming(true);
    abortRef.current = new AbortController();

    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('accessToken')
          : '';

      await fetchEventSource(
        `${CHAT_API_URL}/api/arena/${activeSessionId}/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: content,
            modelIds: selectedModelIds,
          }),
          signal: abortRef.current.signal,

          onmessage(event) {
            try {
              const msg = JSON.parse(event.data);

              if (msg.messageType === 'turn_created') {
                addTurn(
                  msg.payload.turnId,
                  content,
                  msg.payload.responses,
                );
                return;
              }

              if (msg.messageType === 'all_done') {
                setStreaming(false);
                return;
              }

              const modelId = msg.modelId;
              if (!modelId) return;

              switch (msg.messageType) {
                case 'markdown':
                  setResponseStreaming(modelId);
                  if (msg.payload?.content) {
                    appendToResponse(modelId, msg.payload.content);
                  }
                  break;
                case 'done':
                  finalizeResponse(modelId, {
                    durationMs: msg.payload?.durationMs,
                    promptTokens: msg.payload?.promptTokens,
                    completionTokens: msg.payload?.completionTokens,
                    totalTokens: msg.payload?.totalTokens,
                  });
                  break;
                case 'error':
                  setResponseError(
                    modelId,
                    msg.payload?.error || '请求失败',
                  );
                  break;
              }
            } catch (parseError) {
              console.error('Failed to parse arena SSE:', parseError);
            }
          },

          onerror(err) {
            console.error('Arena SSE error:', err);
            setStreaming(false);
            throw err;
          },

          onclose() {
            console.log('Arena SSE closed');
          },

          openWhenHidden: false,

          async onopen(response) {
            if (response.ok) return;
            throw new Error(`HTTP ${response.status}`);
          },
        },
      );
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Arena chat error:', err);
      }
      setStreaming(false);
    }
  };

  if (isLoadingSessions) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--muted)' }}>
        <div className="text-center space-y-3">
          <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto opacity-50" />
          <p className="text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  if (!activeSession) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--muted)' }}>
        <div className="text-center space-y-3">
          <Swords className="w-12 h-12 mx-auto opacity-30" />
          <p className="text-sm">选择或创建一个对比开始</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden">
      <header
        className="flex h-14 w-full min-w-0 flex-shrink-0 items-center"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex w-full min-w-0 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <p
              className="text-[11px] font-medium uppercase tracking-[0.14em]"
              style={{ color: 'var(--muted)' }}
            >
              Arena
            </p>
            {activeSession.turns.length > 0 && !isStreaming && (
              <div className="relative">
                {showClearConfirm ? (
                  <div
                    className="flex items-center gap-1.5 rounded-md px-2 py-1"
                    style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
                  >
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>清空所有消息？</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 min-w-0 px-2 text-xs rounded cursor-pointer"
                      style={{ color: 'var(--danger, #ef4444)' }}
                      onPress={async () => {
                        await clearTurns();
                        setShowClearConfirm(false);
                      }}
                    >
                      确认
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 min-w-0 px-2 text-xs rounded cursor-pointer"
                      style={{ color: 'var(--muted)' }}
                      onPress={() => setShowClearConfirm(false)}
                    >
                      取消
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 min-w-0 gap-1 px-2 text-xs rounded-md cursor-pointer"
                    style={{ color: 'var(--muted)' }}
                    onPress={() => setShowClearConfirm(true)}
                  >
                    <RotateCcw className="h-3 w-3" />
                    清空
                  </Button>
                )}
              </div>
            )}
          </div>
          <ArenaModelSelector />
        </div>
      </header>

      <div className="flex-1 min-w-0 overflow-y-auto py-6">
        <div className="mx-auto w-full min-w-0 max-w-5xl space-y-6 px-6">
          {activeSession.turns.length === 0 && (
            <div className="text-center py-12" style={{ color: 'var(--muted)' }}>
              <Swords className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                练武场
              </p>
              <p className="text-sm">
                选择 2-4 个模型，输入消息进行多模型对比
              </p>
              <p className="text-xs mt-1 opacity-70">
                每个模型的回答将并排显示，附带响应耗时和 token 消耗
              </p>
            </div>
          )}

          {activeSession.turns.map((turn) => (
            <ArenaTurnGroup key={turn.id} turn={turn} />
          ))}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="w-full min-w-0 flex-shrink-0 px-6 pb-6 pt-2">
        <div className="mx-auto w-full min-w-0 max-w-5xl">
          <ChatInput onSend={handleSend} isStreaming={isStreaming} />
        </div>
      </div>
    </div>
  );
}
