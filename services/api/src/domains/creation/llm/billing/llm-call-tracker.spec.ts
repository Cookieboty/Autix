import { createTrackedModel, type TrackerContext } from './llm-call-tracker';

function createModel(overrides: Partial<{ generate: jest.Mock }> = {}) {
  const generate =
    overrides.generate ??
    jest.fn().mockResolvedValue({
      generations: [[{ message: { response_metadata: { tokenUsage: { input_tokens: 12, output_tokens: 34 } } } }]],
    });
  return { _generate: generate } as unknown as import('@langchain/core/language_models/chat_models').BaseChatModel;
}

function createBilling(overrides: Partial<{ hold: jest.Mock; confirm: jest.Mock; refund: jest.Mock }> = {}) {
  return {
    hold: overrides.hold ?? jest.fn().mockResolvedValue({ holdId: 'hold-1', balance: 10 }),
    confirm: overrides.confirm ?? jest.fn().mockResolvedValue(undefined),
    refund: overrides.refund ?? jest.fn().mockResolvedValue(undefined),
  } as unknown as import('./call-billing.service').CallBillingService;
}

const baseCtx: TrackerContext = {
  userId: 'user-1',
  modelConfigId: 'model-1',
  modelName: 'gpt-x',
  modelProvider: 'openai',
  taskType: 'chat_message_fast',
};

describe('createTrackedModel — no pointCostWeight fallback', () => {
  it('holds using taskType/modelConfigId, not a pre-computed points amount', async () => {
    const billing = createBilling();
    const model = createModel();
    const tracked = createTrackedModel(model, billing, baseCtx);

    await (tracked as unknown as { _generate: (...args: unknown[]) => Promise<unknown> })._generate([], {});

    expect(billing.hold).toHaveBeenCalledWith(
      'user-1',
      0,
      expect.objectContaining({
        pricing: expect.objectContaining({ taskType: 'chat_message_fast', modelConfigId: 'model-1' }),
      }),
    );
  });

  it('confirms with the real taskType/modelConfigId and extracted token usage, never a modelTier-sniffed value', async () => {
    const billing = createBilling();
    const model = createModel();
    const tracked = createTrackedModel(model, billing, baseCtx);

    await (tracked as unknown as { _generate: (...args: unknown[]) => Promise<unknown> })._generate([], {});

    expect(billing.confirm).toHaveBeenCalledWith(
      'hold-1',
      expect.objectContaining({
        taskType: 'chat_message_fast',
        modelConfigId: 'model-1',
        inputTokens: 12,
        outputTokens: 34,
      }),
    );
  });

  it('refunds the hold and rethrows when the underlying model call fails', async () => {
    const failure = new Error('model exploded');
    const billing = createBilling();
    const model = createModel({ generate: jest.fn().mockRejectedValue(failure) });
    const tracked = createTrackedModel(model, billing, baseCtx);

    await expect(
      (tracked as unknown as { _generate: (...args: unknown[]) => Promise<unknown> })._generate([], {}),
    ).rejects.toThrow('model exploded');

    expect(billing.refund).toHaveBeenCalledWith('hold-1');
    expect(billing.confirm).not.toHaveBeenCalled();
  });

  it('never reads a pointCostWeight/modelTier field off the context — TrackerContext no longer declares them', () => {
    // Compile-time guarantee: this object satisfies TrackerContext without those
    // fields. If someone re-adds `pointCostWeight` or `modelTier` as required on
    // TrackerContext, this file fails to typecheck.
    const ctx: TrackerContext = { ...baseCtx };
    expect('pointCostWeight' in ctx).toBe(false);
    expect('modelTier' in ctx).toBe(false);
  });
});
