import type { agent_workflow_steps } from '../../../platform/prisma/generated';
import type { LlmWorkflowArtifactRepository } from '../llm.repository';

export function extractArtifactContent(result: unknown): string {
  const record = result && typeof result === 'object'
    ? (result as { messages?: Array<{ content?: unknown }> })
    : {};
  const messages = record.messages || [];
  const lastMsg = messages[messages.length - 1];
  if (!lastMsg) return '';
  return typeof lastMsg.content === 'string' ? lastMsg.content : JSON.stringify(lastMsg.content);
}

export function persistStepArtifact(
  repository: LlmWorkflowArtifactRepository,
  opts: {
    runId: string;
    stepKey: string;
    content: string;
    contentType: agent_workflow_steps['artifactType'];
    version: number;
  },
) {
  return repository.createWorkflowStepArtifact(opts);
}
