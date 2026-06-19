'use client';

import {
  marketplaceActions,
  type AgentKind,
  type AgentResource,
} from '@autix/shared-store';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { KIND_ICON, KIND_LABEL_KEY, WORKBENCH_VISIBLE_KINDS } from './agent-kind-utils';

interface ModeSwitcherProps {
  conversationId: string;
  currentKind: AgentKind;
  currentAgentId?: string;
  onSwitched: () => void;
}

export function ModeSwitcher({
  conversationId,
  currentKind,
  currentAgentId,
  onSwitched,
}: ModeSwitcherProps) {
  const [switching, setSwitching] = useState(false);
  const [agents, setAgents] = useState<AgentResource[]>([]);
  const t = useTranslations('chat.modeSwitcher');
  const tKind = useTranslations('chat.agentKind');

  useEffect(() => {
    let cancelled = false;
    marketplaceActions
      .listSwitchableAgents()
      .then((items) => {
        if (cancelled) return;
        setAgents(items);
      })
      .catch(() => {
        if (!cancelled) setAgents([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const attachAgent = async (agentId: string) => {
    if (agentId === currentAgentId || switching) return;

    setSwitching(true);
    try {
      if (currentAgentId) {
        await marketplaceActions.detachConversationResource(conversationId, 'AGENT', currentAgentId);
      }
      await marketplaceActions.attachConversationResource(conversationId, 'AGENT', agentId);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('conversation-resources:changed'));
      }
      onSwitched();
    } catch (err) {
      console.error('Agent switch failed:', err);
    } finally {
      setSwitching(false);
    }
  };

  const handleSwitch = async (kind: AgentKind) => {
    if (kind === currentKind || switching) return;

    setSwitching(true);
    try {
      const candidates = agents.filter((a) => (a.kind ?? 'chat') === kind);
      const target = candidates.find((a) => a.isSystem) ?? candidates[0];

      if (!target) {
        setSwitching(false);
        return;
      }

      if (currentAgentId) {
        await marketplaceActions.detachConversationResource(conversationId, 'AGENT', currentAgentId);
      }
      await marketplaceActions.attachConversationResource(conversationId, 'AGENT', target.id);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('conversation-resources:changed'));
      }
      onSwitched();
    } catch (err) {
      console.error('Mode switch failed:', err);
    } finally {
      setSwitching(false);
    }
  };

  const chatAgents = agents.filter(
    (agent) => (agent.kind ?? 'chat') === 'chat' && agent.executionMode !== 'workflow',
  );

  const displayAgentTitle = (agent: AgentResource) => {
    if (agent.isSystem && agent.title === 'Default Chat') return t('defaultChatTitle');
    return agent.title.replace(/\s*Agent$/, '');
  };

  const displayAgentDescription = (agent: AgentResource) => {
    if (agent.isSystem && agent.title === 'Default Chat') return t('defaultChatDescription');
    return agent.category || agent.description || t('chatAssistant');
  };

  const kindDescriptionKey: Partial<Record<AgentKind, 'imageGeneration' | 'videoCreation'>> = {
    image: 'imageGeneration',
    video: 'videoCreation',
  };

  return (
    <div className="flex max-w-full items-center gap-1 rounded-[22px] border border-border/80 bg-background/95 p-1.5 shadow-sm">
      {chatAgents.map((agent) => {
        const active = currentKind === 'chat' && agent.id === currentAgentId;
        return (
          <button
            key={agent.id}
            type="button"
            disabled={switching}
            onClick={() => attachAgent(agent.id)}
            className={`inline-flex min-w-[112px] items-center gap-2 rounded-2xl px-3.5 py-2.5 text-left transition-all ${
              active
                ? 'bg-foreground text-background shadow-sm'
                : 'text-foreground hover:bg-secondary'
            }`}
          >
            <span
              className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs ${
                active ? 'bg-background/15' : 'bg-secondary'
              }`}
            >
              {KIND_ICON.chat}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold leading-4">
                {displayAgentTitle(agent)}
              </span>
              <span
                className={`mt-0.5 block truncate text-[11px] leading-3 ${
                  active ? 'text-background/70' : 'text-muted-foreground'
                }`}
              >
                {displayAgentDescription(agent)}
              </span>
            </span>
          </button>
        );
      })}
      {WORKBENCH_VISIBLE_KINDS.filter((kind) => kind !== 'chat').map((kind) => {
        const active = kind === currentKind;
        return (
          <button
            key={kind}
            type="button"
            disabled={switching}
            onClick={() => handleSwitch(kind)}
            className={`inline-flex min-w-[92px] items-center gap-2 rounded-2xl px-3.5 py-2.5 text-left transition-all ${
              active
                ? 'bg-foreground text-background shadow-sm'
                : 'text-foreground hover:bg-secondary'
            }`}
          >
            <span
              className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs ${
                active ? 'bg-background/15' : 'bg-secondary'
              }`}
            >
              {KIND_ICON[kind]}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold leading-4">
                {tKind(KIND_LABEL_KEY[kind])}
              </span>
              <span
                className={`mt-0.5 block truncate text-[11px] leading-3 ${
                  active ? 'text-background/70' : 'text-muted-foreground'
                }`}
              >
                {kindDescriptionKey[kind] ? t(kindDescriptionKey[kind]) : null}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
