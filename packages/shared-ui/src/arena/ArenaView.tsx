'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from '../navigation';
import { Swords, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ModelCategory } from '@autix/shared-lib';
import { getApiBaseUrl, getEffectiveParams, getAuth } from '@autix/shared-lib';
import { Button } from '../ui/button';
import { SidebarTrigger } from '../ui/sidebar';
import { useArenaStore } from '@autix/shared-store';
import { ChatInput } from '../chat/ChatInput';
import { ModelConfigTip } from '../chat/ModelConfigTip';
import { ArenaModelSelector } from './ArenaModelSelector';
import { ArenaTurnGroup } from './ArenaTurnGroup';

interface ArenaViewProps {
  sessionId?: string;
}

export function ArenaView({ sessionId }: ArenaViewProps) {
  const t = useTranslations('arena');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const {
    sessions,
    activeSessionId,
    selectedModelIds,
    activeCategory,
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
    appendImageToResponse,
    finalizeResponse,
    setResponseError,
    fetchAvailableModels,
    availableModels,
    modelParamsMap,
  } = useArenaStore();

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const activeSession = getActiveSession();

  useEffect(() => {
    const init = async () => {
      let state = useArenaStore.getState();
      if (state.availableModels.length === 0) {
        void fetchAvailableModels();
      }

      if (sessionId) {
        let exists = state.sessions.find((s) => s.id === sessionId);
        if (!exists) {
          await fetchSessions();
          state = useArenaStore.getState();
          exists = state.sessions.find((s) => s.id === sessionId);
        }
        if (exists) {
          await setActiveSession(sessionId);
          return;
        }
      }

      if (state.activeSessionId) {
        const existing = state.sessions.find((s) => s.id === state.activeSessionId);
        if (existing) {
          await setActiveSession(existing.id);
          if (!sessionId) router.replace(`/arena/${existing.id}`);
          return;
        }
      }

      if (state.sessions.length === 0) {
        await fetchSessions();
        state = useArenaStore.getState();
      }

      if (state.sessions.length > 0) {
        const first = state.sessions[0];
        await setActiveSession(first.id);
        router.replace(`/arena/${first.id}`);
      } else {
        const id = await createSession(t('newComparison'));
        router.replace(`/arena/${id}`);
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

  const enableImages = activeCategory === 'multimodal';

  const handleSend = async (content: string, images?: string[]) => {
    if (!activeSessionId) return;
    if (isStreaming) return;
    if (selectedModelIds.length < 2) {
      alert(t('minModelsRequired'));
      return;
    }

    setStreaming(true);
    abortRef.current = new AbortController();

    try {
      const token = (await getAuth().getAccessToken()) ?? '';

      const response = await fetch(
        `${getApiBaseUrl()}/api/arena/${activeSessionId}/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: content,
            modelIds: selectedModelIds,
            ...(images?.length ? { images } : {}),
            ...(() => {
              const mp: Record<string, Record<string, any>> = {};
              for (const mid of selectedModelIds) {
                const cfg = modelParamsMap[mid];
                if (cfg) {
                  const effective = getEffectiveParams(cfg);
                  if (Object.keys(effective).length > 0) {
                    mp[mid] = effective;
                  }
                }
              }
              return Object.keys(mp).length > 0 ? { modelParams: mp } : {};
            })(),
          }),
          signal: abortRef.current.signal,
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          const dataLine = part.split('\n').find((l) => l.startsWith('data: '));
          if (!dataLine) continue;

          try {
            const msg = JSON.parse(dataLine.slice(6));

            if (msg.messageType === 'turn_created') {
              addTurn(msg.payload.turnId, content, msg.payload.responses, images);
              continue;
            }

            if (msg.messageType === 'all_done') {
              setStreaming(false);
              continue;
            }

            const modelId = msg.modelId;
            if (!modelId) continue;

            switch (msg.messageType) {
              case 'markdown':
                setResponseStreaming(modelId);
                if (msg.payload?.content) {
                  appendToResponse(modelId, msg.payload.content);
                }
                break;
              case 'image':
                setResponseStreaming(modelId);
                if (msg.payload?.imageUrl) {
                  appendImageToResponse(modelId, msg.payload.imageUrl);
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
                setResponseError(modelId, msg.payload?.error || t('requestFailed'));
                break;
            }
          } catch (parseError) {
            console.error('Failed to parse arena SSE:', parseError);
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Arena chat error:', err);
      }
      setStreaming(false);
    }
  };

  if (isLoadingSessions) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center space-y-3">
          <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto opacity-50" />
          <p className="text-sm">{tCommon('loading')}</p>
        </div>
      </div>
    );
  }

  if (!activeSession) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center space-y-3">
          <Swords className="w-12 h-12 mx-auto opacity-30" />
          <p className="text-sm">{t('selectOrCreate')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden">
      <header className="flex h-12 w-full min-w-0 shrink-0 items-center border-b border-border">
        <div className="flex w-full min-w-0 items-center justify-between px-3">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <p className="ml-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Arena
            </p>
            {activeSession.turns.length > 0 && !isStreaming && (
              <div className="relative">
                {showClearConfirm ? (
                  <div className="flex items-center gap-1.5 rounded-md px-2 py-1 bg-card border border-border">
                    <span className="text-xs text-muted-foreground">{t('clearAllMessages')}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 min-w-0 px-2 text-xs rounded cursor-pointer text-destructive"
                      onClick={async () => {
                        await clearTurns();
                        setShowClearConfirm(false);
                      }}
                    >
                      {tCommon('confirm')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 min-w-0 px-2 text-xs rounded cursor-pointer text-muted-foreground"
                      onClick={() => setShowClearConfirm(false)}
                    >
                      {tCommon('cancel')}
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 min-w-0 gap-1 px-2 text-xs rounded-md cursor-pointer text-muted-foreground"
                    onClick={() => setShowClearConfirm(true)}
                  >
                    <RotateCcw className="h-3 w-3" />
                    {t('clear')}
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
            <div className="text-center py-12 text-muted-foreground">
              <Swords className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium mb-2 text-foreground">
                {t('title')}
              </p>
              <p className="text-sm">
                {t('description')}
              </p>
              <p className="text-xs mt-1 opacity-70">
                {t('subDescription')}
              </p>
              <ModelConfigTip hasModels={availableModels.length > 0} className="mt-6" />
            </div>
          )}

          {activeSession.turns.map((turn) => (
            <ArenaTurnGroup key={turn.id} turn={turn} />
          ))}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="w-full min-w-0 shrink-0 px-6 pb-6 pt-2">
        <div className="mx-auto w-full min-w-0 max-w-5xl">
          <ChatInput onSend={handleSend} isStreaming={isStreaming} enableImages={enableImages} />
        </div>
      </div>
    </div>
  );
}
