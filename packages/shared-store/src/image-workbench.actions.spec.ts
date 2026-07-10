import { afterEach, describe, expect, it, vi } from 'vitest';

const sdkMocks = vi.hoisted(() => ({
  campaignApi: { submitFeedback: vi.fn() },
  imageTemplateApi: { list: vi.fn(), getById: vi.fn() },
  imageWorkbenchApi: {
    history: vi.fn(),
    deleteHistory: vi.fn(),
    generate: vi.fn(),
    refinePrompt: vi.fn(),
    mergeAnnotation: vi.fn(),
  },
  materialsApi: { list: vi.fn(), use: vi.fn(), create: vi.fn(), remove: vi.fn() },
  pointsApi: { getSummary: vi.fn(), estimate: vi.fn() },
}));

vi.mock('@autix/sdk', () => ({
  campaignApi: sdkMocks.campaignApi,
  imageTemplateApi: sdkMocks.imageTemplateApi,
  imageWorkbenchApi: sdkMocks.imageWorkbenchApi,
  materialsApi: sdkMocks.materialsApi,
  pointsApi: sdkMocks.pointsApi,
}));

import { imageWorkbenchActions } from './image-workbench.actions';

describe('imageWorkbenchActions.estimateGeneration', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('forwards the new { taskType, modelConfigId, params } shape unchanged to pointsApi.estimate', async () => {
    sdkMocks.pointsApi.estimate.mockResolvedValue({
      data: {
        estimatedCost: 90,
        taskType: 'image_generation',
        modelConfigId: 'model-1',
        breakdown: [],
        pricingSnapshot: {},
      },
    });

    const input = {
      taskType: 'image_generation',
      modelConfigId: 'model-1',
      params: { quality: 'high' },
    };
    const result = await imageWorkbenchActions.estimateGeneration(input);

    expect(sdkMocks.pointsApi.estimate).toHaveBeenCalledWith(input);
    expect(result.estimatedCost).toBe(90);
  });

  it('forwards usage untouched — never merges usage keys into params', async () => {
    sdkMocks.pointsApi.estimate.mockResolvedValue({
      data: { estimatedCost: 5, taskType: 'chat_message_standard', modelConfigId: 'm', breakdown: [], pricingSnapshot: {} },
    });

    const input = {
      taskType: 'chat_message_standard',
      modelConfigId: 'm',
      params: { temperature: 0.7 },
      usage: { inputTokens: 100, outputTokens: 200 },
    };
    await imageWorkbenchActions.estimateGeneration(input);

    const [forwarded] = sdkMocks.pointsApi.estimate.mock.calls[0] as [typeof input];
    expect(Object.keys(forwarded.params)).not.toContain('inputTokens');
    expect(Object.keys(forwarded.params)).not.toContain('outputTokens');
    expect(forwarded.usage).toEqual({ inputTokens: 100, outputTokens: 200 });
  });
});
