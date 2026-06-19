'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  agentApi,
  conversationResourcesApi,
  type AgentKind,
  type AgentResource,
} from '@autix/sdk';
import { FallbackImage } from '../template/FallbackImage';
import { KIND_ICON, KIND_LABEL_KEY, WORKBENCH_VISIBLE_KINDS } from './agent-kind-utils';

interface AgentPickerDialogProps {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  currentAgentId?: string;
  currentKind: AgentKind;
  isLocked: boolean;
  onSwitched: () => void;
}

export function AgentPickerDialog({
  open,
  onClose,
  conversationId,
  currentAgentId,
  currentKind,
  isLocked,
  onSwitched,
}: AgentPickerDialogProps) {
  const [agents, setAgents] = useState<AgentResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const t = useTranslations('chat.agentPicker');
  const tKind = useTranslations('chat.agentKind');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    agentApi
      .list({ pageSize: 100 })
      .then((res) => {
        const items = ((res.data as any)?.items ?? (res.data as any)) as AgentResource[];
        setAgents(Array.isArray(items) ? items : []);
      })
      .catch(() => setAgents([]))
      .finally(() => setLoading(false));
  }, [open]);

  const grouped = WORKBENCH_VISIBLE_KINDS.map((kind) => ({
    kind,
    items: agents.filter((a) => (a.kind ?? 'chat') === kind),
  }));

  const handleSelect = async (agent: AgentResource) => {
    if (agent.id === currentAgentId) {
      onClose();
      return;
    }
    const agentKind = agent.kind ?? 'chat';
    if (isLocked && agentKind !== currentKind) return;

    setSwitching(agent.id);
    try {
      if (currentAgentId) {
        await conversationResourcesApi.detach(conversationId, 'AGENT', currentAgentId);
      }
      await conversationResourcesApi.attach(conversationId, 'AGENT', agent.id);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('conversation-resources:changed'));
      }
      onSwitched();
      onClose();
    } catch (err: any) {
      console.error('Agent switch failed:', err);
    } finally {
      setSwitching(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[10vh]" onClick={onClose}>
      <div
        className="relative w-[min(720px,calc(100vw-48px))] max-h-[70vh] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">{t('title')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-5" style={{ maxHeight: 'calc(70vh - 64px)' }}>
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">{t('loading')}</div>
          ) : (
            <div className="space-y-6">
              {grouped.map(({ kind, items }) => {
                const disabled = isLocked && kind !== currentKind;
                return (
                  <div key={kind}>
                    <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                      <span>{KIND_ICON[kind]}</span>
                      <span>{tKind(KIND_LABEL_KEY[kind])}</span>
                      {disabled && (
                        <span className="text-[10px] text-muted-foreground">
                          {t('locked')}
                        </span>
                      )}
                    </div>

                    {items.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
                        {t('emptyKind')}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {items.map((agent) => {
                          const isActive = agent.id === currentAgentId;
                          const isSwitching = switching === agent.id;
                          return (
                            <button
                              key={agent.id}
                              type="button"
                              disabled={disabled || isSwitching}
                              onClick={() => handleSelect(agent)}
                              className={`group overflow-hidden rounded-xl border text-left transition-all ${
                                isActive
                                  ? 'border-primary ring-2 ring-primary'
                                  : disabled
                                    ? 'cursor-not-allowed border-border opacity-50'
                                    : 'border-border hover:ring-2 hover:ring-primary'
                              }`}
                            >
                              <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                                <FallbackImage
                                  src={agent.coverImage ?? undefined}
                                  alt={agent.title}
                                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                  fallbackText={KIND_ICON[kind]}
                                />
                                {isActive && (
                                  <span className="absolute right-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                                    {t('current')}
                                  </span>
                                )}
                              </div>
                              <div className="p-2.5">
                                <div className="truncate text-sm font-medium text-foreground">
                                  {agent.title}
                                </div>
                                {agent.description && (
                                  <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                                    {agent.description}
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
