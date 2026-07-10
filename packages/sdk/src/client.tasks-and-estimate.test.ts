import { afterEach, describe, expect, it, vi } from 'vitest';
import { chatApi, pointsApi, tasksApi } from './client';

describe('pointsApi.estimate — new { taskType, modelConfigId, params, usage } contract', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('posts the request body verbatim in the new shape, with tokens kept out of params and order-time fields kept out of usage', async () => {
    const post = vi.spyOn(chatApi, 'post').mockResolvedValue({
      data: {
        estimatedCost: 90,
        taskType: 'image_generation',
        modelConfigId: 'model-1',
        breakdown: [],
        pricingSnapshot: {},
      },
    } as never);

    await pointsApi.estimate({
      taskType: 'image_generation',
      modelConfigId: 'model-1',
      params: { quality: 'high', resolution: '1K' },
      usage: { inputTokens: 10, outputTokens: 20 },
    });

    expect(post).toHaveBeenCalledTimes(1);
    const [url, body] = post.mock.calls[0];
    expect(url).toBe('/api/points/estimate');
    expect(body).toEqual({
      taskType: 'image_generation',
      modelConfigId: 'model-1',
      params: { quality: 'high', resolution: '1K' },
      usage: { inputTokens: 10, outputTokens: 20 },
    });

    const params = body as { params: Record<string, unknown>; usage: Record<string, unknown> };
    expect(Object.keys(params.params)).not.toContain('inputTokens');
    expect(Object.keys(params.params)).not.toContain('outputTokens');
    expect(Object.keys(params.usage)).not.toContain('quality');
    expect(Object.keys(params.usage)).not.toContain('resolution');
  });

  it('accepts an input with no usage (usage is optional)', async () => {
    const post = vi.spyOn(chatApi, 'post').mockResolvedValue({
      data: { estimatedCost: 1, taskType: 'video_generation', modelConfigId: 'm', breakdown: [], pricingSnapshot: {} },
    } as never);

    await pointsApi.estimate({
      taskType: 'video_generation',
      params: { resolution: '720p', seconds: 5 },
    });

    expect(post).toHaveBeenCalledWith(
      '/api/points/estimate',
      { taskType: 'video_generation', params: { resolution: '720p', seconds: 5 } },
    );
  });
});

describe('tasksApi', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes listTasks/listModels/quote', () => {
    expect(typeof tasksApi.listTasks).toBe('function');
    expect(typeof tasksApi.listModels).toBe('function');
    expect(typeof tasksApi.quote).toBe('function');
  });

  it('listTasks GETs /api/tasks', async () => {
    const get = vi.spyOn(chatApi, 'get').mockResolvedValue({ data: [] } as never);
    await tasksApi.listTasks();
    expect(get).toHaveBeenCalledWith('/api/tasks');
  });

  it('listModels GETs /api/tasks/:taskType/models', async () => {
    const get = vi.spyOn(chatApi, 'get').mockResolvedValue({ data: [] } as never);
    await tasksApi.listModels('image_generation');
    expect(get).toHaveBeenCalledWith('/api/tasks/image_generation/models');
  });

  it('quote POSTs { modelConfigId, params, usage } to /api/tasks/:taskType/quote, taskType stays out of the body', async () => {
    const post = vi.spyOn(chatApi, 'post').mockResolvedValue({
      data: { total: 5, breakdown: [], snapshot: {} },
    } as never);

    await tasksApi.quote('image_generation', {
      modelConfigId: 'model-1',
      params: { quality: 'high' },
      usage: {},
    });

    expect(post).toHaveBeenCalledWith('/api/tasks/image_generation/quote', {
      modelConfigId: 'model-1',
      params: { quality: 'high' },
      usage: {},
    });
  });
});
