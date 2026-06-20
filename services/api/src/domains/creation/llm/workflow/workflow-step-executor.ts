import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage } from '@langchain/core/messages';
import type { PrismaService } from '../../../platform/prisma/prisma.service';
import type { SearchService } from '../../document/search.service';
import type { CallBillingService } from '../billing/call-billing.service';
import type { WorkflowStepEvent } from './workflow.types';
import { buildStepContext } from './context-builder';
import { createStepAgent } from '../deepagents/deepagent.factory';
import { validateStepArtifact, type ValidationSchema } from './step-validator';
import { evaluateWithCritic } from './step-critic';
import { proposeNextStep } from './next-step-proposer';
import type { agent_workflow_steps, agent_runs } from '../../../platform/prisma/generated';
import type { SystemPromptService } from '../../../platform/system-settings/system-prompt.service';
import { extractArtifactContent, persistStepArtifact } from './workflow-artifacts';
import {
  appendRefineFeedback,
  buildConstrainedStepPrompt,
  buildNextStepCandidateList,
  buildNextStepOptions,
  type RemainingWorkflowStep,
} from './workflow-prompts';
import {
  resolveCriticPassThreshold,
  resolveCriticRuntimeModelConfig,
  shouldEvaluateCritic,
} from './critic-model-resolution';
import {
  createTrackedWorkflowModel,
  toRuntimeModelConfig,
  type RuntimeModelConfig,
} from './workflow-models';

export { toRuntimeModelConfig };
export type { RuntimeModelConfig };

export interface StepExecutorDeps {
  prisma: PrismaService;
  searchService: SearchService;
  billing: CallBillingService;
  systemPromptService: SystemPromptService;
  libraryEnabled?: boolean;
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
  remainingSteps: RemainingWorkflowStep[],
  stepIndex: number,
  totalSteps: number,
  modelConfig: RuntimeModelConfig,
): AsyncGenerator<WorkflowStepEvent> {
  const { prisma, searchService, billing, systemPromptService, libraryEnabled = true } = deps;

  // 1. Build context
  const context = await buildStepContext(
    { prisma, searchService, libraryEnabled },
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
  const {
    model: trackedModel,
  } = createTrackedWorkflowModel({
    billing,
    modelConfig,
    userId,
    runId: run.id,
  });

  // 3. Enforce single-goal constraint in system prompt
  const constrainedPrompt = buildConstrainedStepPrompt(context.renderedPrompt, stepDef.stepKey);

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
    const agent = createStepAgent({
      model: trackedModel,
      systemPrompt: appendRefineFeedback(constrainedPrompt, feedback),
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
    const stepArtifact = await persistStepArtifact(prisma, {
      runId: run.id,
      stepKey: stepDef.stepKey,
      content: artifactContent,
      contentType: stepDef.artifactType,
      version: attempt,
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
    if (shouldEvaluateCritic(run.depthMode, stepDef)) {
      const criticPromptTemplate = stepDef.criticPromptTemplate;

      const criticRuntimeConfig = await resolveCriticRuntimeModelConfig(
        prisma,
        stepDef,
        modelConfig,
      );

      if (criticRuntimeConfig) {
        const { model: trackedCriticModel } = createTrackedWorkflowModel({
          billing,
          modelConfig: criticRuntimeConfig,
          userId,
          runId: run.id,
        });
        const threshold = resolveCriticPassThreshold(stepDef.criticPassThreshold);

        const criticResult = await evaluateWithCritic(
          trackedCriticModel,
          artifactContent,
          criticPromptTemplate,
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
  const candidateList = buildNextStepCandidateList(remainingSteps);
  const proposalPrompt = await systemPromptService.render('workflow.nextStep', { candidateList });
  const proposal = await proposeNextStep(
    trackedModel as BaseChatModel,
    stepDef.stepKey,
    remainingSteps,
    artifactContent.slice(0, 500),
    proposalPrompt.content,
  );

  yield {
    type: 'step_completed',
    stepKey: stepDef.stepKey,
    proposedNextStep: proposal.proposedNextStep ?? undefined,
    proposalReasoning: proposal.reasoning,
    nextOptions: buildNextStepOptions(remainingSteps),
  };
}
