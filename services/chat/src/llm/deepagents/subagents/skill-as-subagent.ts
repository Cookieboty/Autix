import type { SubAgent } from 'deepagents';

export interface SkillRecord {
  id: string;
  title: string;
  description?: string | null;
  instructions: string;
}

export function skillAsSubagent(skill: SkillRecord): SubAgent {
  return {
    name: `skill-${skill.id}`,
    description: skill.description || skill.title,
    systemPrompt: skill.instructions,
  };
}
