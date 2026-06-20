import type {
  LogPayload,
  MarkdownPayload,
  PointsConsumedPayload,
  ProgressPayload,
  StepArtifactCreatedPayload,
  StepCompletedPayload,
  StreamMessage,
} from '@autix/domain/ai-ui';
import type { WorkflowStepEvent } from '../llm/workflow/workflow.types';

export function formatSseData(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export function workflowEventToStreamMessage(
  event: WorkflowStepEvent,
  timestamp = new Date().toISOString(),
): StreamMessage | null {
  switch (event.type) {
    case 'run_started':
      return {
        messageType: 'log',
        timestamp,
        payload: {
          level: 'info',
          message: `Workflow run started: ${event.runId}`,
        },
      } as StreamMessage;
    case 'step_started':
      return {
        messageType: 'progress',
        timestamp,
        payload: {
          stepKey: event.stepKey,
          displayName: event.displayName,
          index: event.index,
          total: event.total,
          status: 'started',
        } as ProgressPayload,
      } as StreamMessage;
    case 'llm_token':
      return {
        messageType: 'markdown',
        timestamp,
        payload: {
          content: event.content,
          isChunk: true,
        } as MarkdownPayload,
      } as StreamMessage;
    case 'prompt_suggestion':
      return {
        messageType: 'prompt_suggestion',
        timestamp,
        payload: {
          prompt: event.prompt,
          model: event.model,
          reasoning: event.reasoning,
        },
      } as StreamMessage;
    case 'edit_suggestion':
      return {
        messageType: 'edit_suggestion',
        timestamp,
        payload: {
          instruction: event.instruction,
          sourceImages: event.sourceImages,
          model: event.model,
          reasoning: event.reasoning,
        },
      } as StreamMessage;
    case 'image_generating':
      return {
        messageType: 'image_generating',
        timestamp,
        payload: {
          taskId: event.taskId,
          model: event.model,
          count: event.count,
        },
      } as StreamMessage;
    case 'image_editing':
      return {
        messageType: 'image_editing',
        timestamp,
        payload: {
          taskId: event.taskId,
          model: event.model,
          count: event.count,
          sourceImages: event.sourceImages,
        },
      } as StreamMessage;
    case 'image_generated':
      return {
        messageType: 'image_result',
        timestamp,
        payload: {
          taskId: event.taskId,
          images: event.images,
          prompt: event.prompt,
          model: event.model,
          sourceImages: event.sourceImages,
        },
      } as StreamMessage;
    case 'step_artifact':
      return {
        messageType: 'step_artifact_created',
        timestamp,
        payload: {
          stepKey: event.stepKey,
          artifactStepId: event.artifactStepId,
          contentType: event.contentType,
          version: event.version,
        } as StepArtifactCreatedPayload,
      } as StreamMessage;
    case 'step_completed':
      return {
        messageType: 'step_completed',
        timestamp,
        payload: {
          stepKey: event.stepKey,
          proposedNextStep: event.proposedNextStep,
          proposalReasoning: event.proposalReasoning,
          nextOptions: event.nextOptions,
        } as StepCompletedPayload,
      } as StreamMessage;
    case 'step_failed':
      return {
        messageType: 'step_failed',
        timestamp,
        payload: { error: event.error },
      } as StreamMessage;
    case 'step_validation_failed':
      return {
        messageType: 'step_validation_failed',
        timestamp,
        payload: {
          stepKey: event.stepKey,
          reasons: event.reasons,
        },
      } as StreamMessage;
    case 'step_refining':
      return {
        messageType: 'step_refining',
        timestamp,
        payload: {
          stepKey: event.stepKey,
          attempt: event.attempt,
          cause: event.cause,
        },
      } as StreamMessage;
    case 'step_critic_evaluated':
      return {
        messageType: 'step_critic_evaluated',
        timestamp,
        payload: {
          stepKey: event.stepKey,
          score: event.score,
          passed: event.passed,
          feedback: event.feedback,
        },
      } as StreamMessage;
    case 'points_consumed':
      return {
        messageType: 'points_consumed',
        timestamp,
        payload: {
          stepKey: event.stepKey,
          points: event.points,
          balance: event.balance,
        } as PointsConsumedPayload,
      } as StreamMessage;
    case 'run_paused':
      return {
        messageType: 'run_paused',
        timestamp,
        payload: { reason: event.reason },
      } as StreamMessage;
    case 'run_completed':
      return {
        messageType: 'log',
        timestamp,
        payload: {
          level: 'info',
          message: 'Workflow run completed',
        },
      } as StreamMessage;
    case 'log':
      return {
        messageType: 'log',
        timestamp,
        payload: {
          level: event.level,
          message: event.message,
          data: event.data,
        } as LogPayload,
      } as StreamMessage;
    case 'tool_call':
    case 'subagent_handoff':
      return null;
  }
}
