'use client';

import {
  agentApi,
  conversationResourcesApi,
  meApi,
  type AgentKind,
  type AgentResource,
} from '@autix/shared-lib';
import { useEffect, useState } from 'react';
import { ALL_KINDS, KIND_ICON, KIND_LABEL, isKindActive } from './agent-kind-utils';

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

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      agentApi.list({ pageSize: 100 }),
      meApi.resources('acquired', { pageSize: 100 }),
    ])
      .then(([agentResult, acquiredResult]) => {
        if (cancelled) return;
        const allAgents =
          agentResult.status === 'fulfilled'
            ? (((agentResult.value.data as any)?.items ?? (agentResult.value.data as any)) as AgentResource[])
            : [];
        const acquiredItems =
          acquiredResult.status === 'fulfilled'
            ? (((acquiredResult.value.data as any)?.items ?? []) as any[])
            : [];
        const acquiredAgents = acquiredItems
          .filter((item) => item.resourceType === 'AGENT' && item.resource)
          .map((item) => item.resource as AgentResource);
        const byId = new Map<string, AgentResource>();
        for (const agent of allAgents) {
          if (agent.isSystem) byId.set(agent.id, agent);
        }
        for (const agent of acquiredAgents) {
          byId.set(agent.id, agent);
        }
        setAgents(Array.from(byId.values()));
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
        await conversationResourcesApi.detach(conversationId, 'AGENT', currentAgentId);
      }
      await conversationResourcesApi.attach(conversationId, 'AGENT', agentId);
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
        await conversationResourcesApi.detach(conversationId, 'AGENT', currentAgentId);
      }
      await conversationResourcesApi.attach(conversationId, 'AGENT', target.id);
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
    if (agent.isSystem && agent.title === 'Default Chat') return '通用助手';
    return agent.title.replace(/\s*Agent$/, '');
  };

  const displayAgentDescription = (agent: AgentResource) => {
    if (agent.isSystem && agent.title === 'Default Chat') return '全能助手';
    return agent.category || agent.description || '对话助手';
  };

  const kindDescription: Record<Exclude<AgentKind, 'chat'>, string> = {
    image: '图片生成',
    video: '视频创作',
    avatar: '数字人',
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
      {ALL_KINDS.filter((kind) => kind !== 'chat').map((kind) => {
        const active = kind === currentKind;
        const available = isKindActive(kind);
        return (
          <button
            key={kind}
            type="button"
            disabled={switching || !available}
            onClick={() => handleSwitch(kind)}
            className={`inline-flex min-w-[92px] items-center gap-2 rounded-2xl px-3.5 py-2.5 text-left transition-all ${
              active
                ? 'bg-foreground text-background shadow-sm'
                : available
                  ? 'text-foreground hover:bg-secondary'
                  : 'cursor-not-allowed text-muted-foreground opacity-45'
            }`}
            title={!available ? `${KIND_LABEL[kind]}即将上线` : undefined}
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
                {KIND_LABEL[kind]}
              </span>
              <span
                className={`mt-0.5 block truncate text-[11px] leading-3 ${
                  active ? 'text-background/70' : 'text-muted-foreground'
                }`}
              >
                {kindDescription[kind]}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
