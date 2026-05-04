import type { SubAgent } from 'deepagents';

export interface AgentRecord {
  id: string;
  title: string;
  description?: string | null;
  systemPrompt: string;
  toolBindings: unknown;
}

export function agentAsSubagent(agent: AgentRecord): SubAgent {
  return {
    name: `agent-${agent.id}`,
    description: agent.description || agent.title,
    systemPrompt: agent.systemPrompt,
  };
}
