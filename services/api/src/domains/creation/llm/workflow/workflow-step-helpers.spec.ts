import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { extractArtifactContent, persistStepArtifact } from './workflow-artifacts';
import {
  buildConstrainedStepPrompt,
  appendRefineFeedback,
  buildNextStepCandidateList,
  buildNextStepOptions,
} from './workflow-prompts';
import {
  createTrackedWorkflowModel,
  resolveBillingTier,
  toRuntimeModelConfig,
} from './workflow-models';
import {
  resolveCriticPassThreshold,
  resolveCriticRuntimeModelConfig,
  shouldEvaluateCritic,
} from './critic-model-resolution';

describe('workflow step helpers', () => {
  it('builds the constrained prompt and refine feedback without changing copy', () => {
    const constrained = buildConstrainedStepPrompt('基础 prompt', 'outline');

    expect(constrained).toBe(
      '基础 prompt\n\n【重要约束】你只需要产出 "outline" 阶段的内容。不要执行其他阶段的任务。产出完成后立即停止。',
    );
    expect(appendRefineFeedback(constrained, '')).toBe(constrained);
    expect(appendRefineFeedback(constrained, '补充细节')).toBe(
      `${constrained}\n\n【修改要求】根据以下反馈改进你的产出：\n补充细节`,
    );
  });

  it('builds next-step proposal inputs with optional and jump semantics preserved', () => {
    const remaining = [
      { stepKey: 'draft', displayName: '初稿', isOptional: false },
      { stepKey: 'polish', displayName: '润色', isOptional: true },
    ];

    expect(buildNextStepCandidateList(remaining)).toBe(
      '- draft (初稿)\n- polish (润色, 可选)',
    );
    expect(buildNextStepOptions(remaining)).toEqual([
      'continue',
      'stop',
      'retry',
      'jump_to',
    ]);
    expect(buildNextStepOptions(remaining.slice(0, 1))).toEqual([
      'continue',
      'stop',
      'retry',
    ]);
  });

  it('extracts artifact content from the final agent message', () => {
    expect(extractArtifactContent({ messages: [{ content: 'first' }, { content: 'last' }] }))
      .toBe('last');
    expect(extractArtifactContent({ messages: [{ content: [{ type: 'text', text: 'hi' }] }] }))
      .toBe(JSON.stringify([{ type: 'text', text: 'hi' }]));
    expect(extractArtifactContent({ messages: [] })).toBe('');
  });

  it('persists step artifacts with the existing schema fields', async () => {
    const createWorkflowStepArtifact = jest.fn().mockResolvedValue({ id: 'artifact-1' });

    const result = await persistStepArtifact(
      { createWorkflowStepArtifact } as never,
      {
        runId: 'run-1',
        stepKey: 'draft',
        content: 'artifact body',
        contentType: 'markdown' as never,
        version: 2,
      },
    );

    expect(result).toEqual({ id: 'artifact-1' });
    expect(createWorkflowStepArtifact).toHaveBeenCalledWith({
      runId: 'run-1',
      stepKey: 'draft',
      content: 'artifact body',
      contentType: 'markdown',
      version: 2,
    });
  });

  it('creates tracked models for platform models and skips tracking for user-owned models', () => {
    const baseModel = { name: 'base' } as unknown as BaseChatModel;
    const trackedModel = { name: 'tracked' } as unknown as BaseChatModel;
    const createModel = jest.fn().mockReturnValue(baseModel);
    const createTracked = jest.fn().mockReturnValue(trackedModel);
    const billing = {} as never;
    const modelConfig = toRuntimeModelConfig({
      id: 'model-1',
      model: 'gpt-4.1',
      provider: 'openai',
      metadata: { billingTier: 'standard' },
      type: 'general',
      pointCostWeight: '2',
    });

    const platform = createTrackedWorkflowModel(
      { billing, modelConfig, userId: 'user-1', runId: 'run-1' },
      { createModel, createTracked },
    );

    expect(platform.model).toBe(trackedModel);
    expect(platform.trackerContext).toEqual({
      userId: 'user-1',
      runId: 'run-1',
      runStepId: undefined,
      modelConfigId: 'model-1',
      modelName: 'gpt-4.1',
      modelProvider: 'openai',
      modelTier: 'standard',
      pointCostWeight: 2,
    });
    expect(createTracked).toHaveBeenCalledWith(baseModel, billing, platform.trackerContext);

    // 自有模型不再免费：即使 createdBy === userId 也一律走 tracked model。
    createTracked.mockClear();
    const ownModel = createTrackedWorkflowModel(
      {
        billing,
        modelConfig: { ...modelConfig, id: 'model-2', createdBy: 'user-1' },
        userId: 'user-1',
      },
      { createModel, createTracked },
    );

    expect(ownModel.model).toBe(trackedModel);
    expect(createTracked).toHaveBeenCalledTimes(1);
  });

  it('resolves billing tier and critic settings with existing defaults', async () => {
    expect(resolveBillingTier({ metadata: { billingTier: 'reasoning' } })).toBe('reasoning');
    expect(resolveBillingTier({ metadata: { billingTier: 1 } })).toBeUndefined();

    expect(shouldEvaluateCritic('deep', {
      criticEnabled: true,
      criticPromptTemplate: 'score it',
    } as never)).toBe(true);
    expect(shouldEvaluateCritic('standard', {
      criticEnabled: true,
      criticPromptTemplate: 'score it',
    } as never)).toBe(false);
    expect(resolveCriticPassThreshold(undefined)).toBe(0.7);
    expect(resolveCriticPassThreshold(0)).toBe(0.7);
    expect(resolveCriticPassThreshold('0.85')).toBe(0.85);

    const findModelConfig = jest.fn().mockResolvedValue({
      id: 'critic-1',
      model: 'gpt-4.1',
      provider: 'openai',
      type: 'general',
      pointCostWeight: '3',
    });
    const criticConfig = await resolveCriticRuntimeModelConfig(
      { findModelConfig } as never,
      { criticModelConfigId: 'critic-1' } as never,
      toRuntimeModelConfig({
        id: 'fallback',
        model: 'fallback-model',
        type: 'general',
      }),
    );

    expect(findModelConfig).toHaveBeenCalledWith('critic-1');
    expect(criticConfig).toMatchObject({
      id: 'critic-1',
      model: 'gpt-4.1',
      pointCostWeight: 3,
    });
  });
});
