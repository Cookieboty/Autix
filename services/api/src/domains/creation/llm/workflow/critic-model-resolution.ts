import type { agent_workflow_steps } from '../../../platform/prisma/generated';
import type { PrismaService } from '../../../platform/prisma/prisma.service';
import {
  toRuntimeModelConfig,
  type RuntimeModelConfig,
  type RuntimeModelConfigInput,
} from './workflow-models';

export function shouldEvaluateCritic(
  depthMode: string | null | undefined,
  stepDef: Pick<agent_workflow_steps, 'criticEnabled' | 'criticPromptTemplate'>,
): stepDef is Pick<agent_workflow_steps, 'criticEnabled' | 'criticPromptTemplate'> & {
  criticPromptTemplate: string;
} {
  return depthMode === 'deep' && stepDef.criticEnabled && !!stepDef.criticPromptTemplate;
}

export async function resolveCriticRuntimeModelConfig(
  prisma: PrismaService,
  stepDef: Pick<agent_workflow_steps, 'criticModelConfigId'>,
  fallbackConfig: RuntimeModelConfig,
): Promise<RuntimeModelConfig | null> {
  const criticModelConfig = stepDef.criticModelConfigId
    ? await prisma.model_configs.findUnique({ where: { id: stepDef.criticModelConfigId } })
    : fallbackConfig;

  return criticModelConfig
    ? toRuntimeModelConfig(criticModelConfig as RuntimeModelConfigInput)
    : null;
}

export function resolveCriticPassThreshold(value: unknown): number {
  return value ? Number(value) : 0.7;
}
