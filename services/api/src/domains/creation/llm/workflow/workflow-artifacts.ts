import type { agent_workflow_steps } from '../../../platform/prisma/generated';
import type { PrismaService } from '../../../platform/prisma/prisma.service';

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
  prisma: PrismaService,
  opts: {
    runId: string;
    stepKey: string;
    content: string;
    contentType: agent_workflow_steps['artifactType'];
    version: number;
  },
) {
  return prisma.workflow_step_artifacts.create({
    data: {
      runId: opts.runId,
      stepKey: opts.stepKey,
      content: opts.content,
      contentType: opts.contentType,
      version: opts.version,
    },
  });
}
