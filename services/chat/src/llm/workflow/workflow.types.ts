import type { AgentRunDepthMode } from '@prisma/client';

export type WorkflowStepEvent =
  | { type: 'run_started'; runId: string; agentId: string; workflowId: string; targetStepKey?: string; depthMode: AgentRunDepthMode }
  | { type: 'step_started'; stepKey: string; displayName: string; index: number; total: number; attempt: number }
  | { type: 'llm_token'; stepKey: string; content: string }
  | { type: 'tool_call'; stepKey: string; tool: string; args: Record<string, unknown> }
  | { type: 'subagent_handoff'; stepKey: string; subagent: string }
  | { type: 'points_consumed'; stepKey: string; points: number; balance: number }
  | { type: 'step_artifact'; stepKey: string; artifactStepId: string; contentType: string; version: number }
  | { type: 'step_validation_failed'; stepKey: string; reasons: string[] }
  | { type: 'step_refining'; stepKey: string; attempt: number; cause: 'schema' | 'critic' }
  | { type: 'step_critic_evaluated'; stepKey: string; score: number; passed: boolean; feedback: string }
  | { type: 'step_completed'; stepKey: string; proposedNextStep?: string; proposalReasoning?: string; nextOptions: ('continue' | 'stop' | 'retry' | 'jump_to')[] }
  | { type: 'step_failed'; stepKey: string; error: string }
  | { type: 'run_paused'; reason: 'user_confirm' | 'user_stop' | 'failure' | 'insufficient_points' }
  | { type: 'run_completed'; finalArtifactId?: string }
  | { type: 'log'; level: 'info' | 'debug' | 'error'; message: string; data?: Record<string, unknown> };
