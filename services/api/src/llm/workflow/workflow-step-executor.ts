import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage } from '@langchain/core/messages';
import type { PrismaService } from '../../prisma/prisma.service';
import type { SearchService } from '../../document/search.service';
import type { CallBillingService } from '../billing/call-billing.service';
import type { WorkflowStepEvent } from './workflow.types';
import { buildStepContext } from './context-builder';
import { createStepAgent } from '../deepagents/deepagent.factory';
import { createTrackedModel, type TrackerContext } from '../billing/llm-call-tracker';
import { validateStepArtifact, type ValidationSchema } from './step-validator';
import { evaluateWithCritic } from './step-critic';
import { proposeNextStep } from './next-step-proposer';
import { createChatModelFromDbConfig } from '../model.factory';
import type { agent_workflow_steps, agent_runs } from '../../prisma/generated';

export interface StepExecutorDeps {
  prisma: PrismaService;
  searchService: SearchService;
  billing: CallBillingService;
}

/**
 * 执行单个 workflow step 的完整流程：
 * context build → DeepAgent execute → schema validate → critic (optional) → propose next
 */
export async function* executeStep(
  deps: StepExecutorDeps,
  run: agent_runs,
  stepDef: agent_workflow_steps,
  userId: string,
  userInput: string,
  remainingSteps: Array<{ stepKey: string; displayName: string; isOptional: boolean }>,
  stepIndex: number,
  totalSteps: number,
  modelConfig: { id: string; model: string; apiKey?: string | null; baseUrl?: string | null; metadata?: unknown; type: string; pointCostWeight: number },
): AsyncGenerator<WorkflowStepEvent> {
  const { prisma, searchService, billing } = deps;

  // 1. Build context
  const context = await buildStepContext(
    { prisma, searchService },
    {
      conversationId: run.conversationId,
      userId,
      userInput,
      promptTemplate: stepDef.promptTemplate,
      inputArtifactKeys: stepDef.inputArtifactKeys,
      runId: run.id,
      stepToolBindings: stepDef.toolBindings as Record<string, unknown> | null,
    },
  );

  // 2. Create tracked model
  const baseModel = createChatModelFromDbConfig(modelConfig);
  const isOwnModel = (modelConfig as any).createdBy === userId;
  const trackerCtx: TrackerContext = {
    userId,
    runId: run.id,
    modelConfigId: modelConfig.id,
    modelName: modelConfig.model ?? (modelConfig as any).name,
    modelProvider: (modelConfig as any).provider,
    modelTier: resolveBillingTier(modelConfig),
    pointCostWeight: modelConfig.pointCostWeight,
  };
  const trackedModel = isOwnModel ? baseModel : createTrackedModel(baseModel, billing, trackerCtx);

  // 3. Enforce single-goal constraint in system prompt
  const constrainedPrompt = context.renderedPrompt +
    `\n\n【重要约束】你只需要产出 "${stepDef.stepKey}" 阶段的内容。不要执行其他阶段的任务。产出完成后立即停止。`;

  let attempt = 0;
  const maxAttempts = stepDef.maxRefineAttempts;
  let artifactContent = '';
  let feedback = '';

  while (attempt <= maxAttempts) {
    attempt++;

    yield {
      type: 'step_started',
      stepKey: stepDef.stepKey,
      displayName: stepDef.displayName,
      index: stepIndex,
      total: totalSteps,
      attempt,
    };

    // 4. Execute via DeepAgent
    const refineFeedback = feedback
      ? `\n\n【修改要求】根据以下反馈改进你的产出：\n${feedback}`
      : '';

    const agent = createStepAgent({
      model: trackedModel,
      systemPrompt: constrainedPrompt + refineFeedback,
      tools: context.tools,
      subagents: context.subagents,
    });

    const result = await agent.invoke({
      messages: [new HumanMessage(userInput)],
    });

    artifactContent = extractArtifactContent(result);

    // 5. Stream the artifact content as tokens
    yield { type: 'llm_token', stepKey: stepDef.stepKey, content: artifactContent };

    // 6. Save step artifact
    const stepArtifact = await prisma.workflow_step_artifacts.create({
      data: {
        runId: run.id,
        stepKey: stepDef.stepKey,
        content: artifactContent,
        contentType: stepDef.artifactType,
        version: attempt,
      },
    });

    yield {
      type: 'step_artifact',
      stepKey: stepDef.stepKey,
      artifactStepId: stepArtifact.id,
      contentType: stepDef.artifactType,
      version: attempt,
    };

    // 7. Schema validation (mandatory)
    const validationSchema = stepDef.validationSchema as ValidationSchema | null;
    const validation = validateStepArtifact(artifactContent, validationSchema);

    if (!validation.passed) {
      yield {
        type: 'step_validation_failed',
        stepKey: stepDef.stepKey,
        reasons: validation.reasons,
      };

      if (attempt < maxAttempts) {
        feedback = `Schema 校验失败:\n${validation.reasons.join('\n')}`;
        yield { type: 'step_refining', stepKey: stepDef.stepKey, attempt, cause: 'schema' };
        continue;
      }

      yield { type: 'step_failed', stepKey: stepDef.stepKey, error: `Schema 校验失败且超过最大重试次数: ${validation.reasons.join('; ')}` };
      return;
    }

    // 8. LLM Critic (optional, deep mode only)
    if (run.depthMode === 'deep' && stepDef.criticEnabled && stepDef.criticPromptTemplate) {
      const criticModelConfig = stepDef.criticModelConfigId
        ? await prisma.model_configs.findUnique({ where: { id: stepDef.criticModelConfigId } })
        : modelConfig;

      if (criticModelConfig) {
        const criticModel = createChatModelFromDbConfig(criticModelConfig as any);
        const isOwnCriticModel = (criticModelConfig as any).createdBy === userId;
        const trackedCriticModel = isOwnCriticModel
          ? criticModel
          : createTrackedModel(criticModel, billing, {
              ...trackerCtx,
              modelConfigId: criticModelConfig.id,
              modelName: (criticModelConfig as any).model ?? (criticModelConfig as any).name,
              modelProvider: (criticModelConfig as any).provider,
              modelTier: resolveBillingTier(criticModelConfig),
              pointCostWeight: (criticModelConfig as any).pointCostWeight ?? 1,
            });

        const threshold = stepDef.criticPassThreshold
          ? Number(stepDef.criticPassThreshold)
          : 0.7;

        const criticResult = await evaluateWithCritic(
          trackedCriticModel,
          artifactContent,
          stepDef.criticPromptTemplate,
          threshold,
        );

        yield {
          type: 'step_critic_evaluated',
          stepKey: stepDef.stepKey,
          score: criticResult.score,
          passed: criticResult.passed,
          feedback: criticResult.feedback,
        };

        if (!criticResult.passed && attempt < maxAttempts) {
          feedback = `Critic 评分 ${criticResult.score.toFixed(2)} < ${threshold}:\n${criticResult.feedback}`;
          yield { type: 'step_refining', stepKey: stepDef.stepKey, attempt, cause: 'critic' };
          continue;
        }
      }
    }

    // 9. All validation passed — break out of retry loop
    break;
  }

  // 10. Propose next step
  const proposal = await proposeNextStep(
    trackedModel as BaseChatModel,
    stepDef.stepKey,
    remainingSteps,
    artifactContent.slice(0, 500),
  );

  const nextOptions: ('continue' | 'stop' | 'retry' | 'jump_to')[] = ['continue', 'stop', 'retry'];
  if (remainingSteps.length > 1) nextOptions.push('jump_to');

  yield {
    type: 'step_completed',
    stepKey: stepDef.stepKey,
    proposedNextStep: proposal.proposedNextStep ?? undefined,
    proposalReasoning: proposal.reasoning,
    nextOptions,
  };
}

function extractArtifactContent(result: any): string {
  const messages = result.messages || [];
  const lastMsg = messages[messages.length - 1];
  if (!lastMsg) return '';
  return typeof lastMsg.content === 'string' ? lastMsg.content : JSON.stringify(lastMsg.content);
}

function resolveBillingTier(config: unknown): string | undefined {
  const metadata = (config as any)?.metadata;
  const tier = metadata && typeof metadata === 'object'
    ? (metadata as Record<string, unknown>).billingTier
    : undefined;
  return typeof tier === 'string' ? tier : undefined;
}
