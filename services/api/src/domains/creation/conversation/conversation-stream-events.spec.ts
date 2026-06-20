import {
  formatSseData,
  workflowEventToStreamMessage,
} from './conversation-stream-events';
import type { WorkflowStepEvent } from '../llm/workflow/workflow.types';

describe('conversation stream events', () => {
  const timestamp = '2026-01-02T03:04:05.000Z';

  it('formats SSE data frames', () => {
    expect(formatSseData({ messageType: 'done', payload: null })).toBe(
      'data: {"messageType":"done","payload":null}\n\n',
    );
  });

  it('maps workflow step starts to progress stream messages', () => {
    const event: WorkflowStepEvent = {
      type: 'step_started',
      stepKey: 'draft',
      displayName: 'Draft',
      index: 1,
      total: 3,
      attempt: 1,
    };

    expect(workflowEventToStreamMessage(event, timestamp)).toEqual({
      messageType: 'progress',
      timestamp,
      payload: {
        stepKey: 'draft',
        displayName: 'Draft',
        index: 1,
        total: 3,
        status: 'started',
      },
    });
  });

  it('maps generated images to image result stream messages', () => {
    const event: WorkflowStepEvent = {
      type: 'image_generated',
      taskId: 'img-1',
      images: ['https://img.test/1.png'],
      prompt: 'A product photo',
      model: 'gpt-image-2',
      sourceImages: [{ url: 'https://img.test/source.png', prompt: 'source' }],
    };

    expect(workflowEventToStreamMessage(event, timestamp)).toEqual({
      messageType: 'image_result',
      timestamp,
      payload: {
        taskId: 'img-1',
        images: ['https://img.test/1.png'],
        prompt: 'A product photo',
        model: 'gpt-image-2',
        sourceImages: [{ url: 'https://img.test/source.png', prompt: 'source' }],
      },
    });
  });

  it('keeps workflow-only events silent in the SSE stream', () => {
    const event: WorkflowStepEvent = {
      type: 'tool_call',
      stepKey: 'draft',
      tool: 'search_user_documents',
      args: { query: 'brief' },
    };

    expect(workflowEventToStreamMessage(event, timestamp)).toBeNull();
  });
});
