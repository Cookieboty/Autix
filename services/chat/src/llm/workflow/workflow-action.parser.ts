export type WorkflowActionType =
  | 'start'
  | 'continue'
  | 'stop'
  | 'retry'
  | 'select_target'
  | 'select_depth';

export interface WorkflowAction {
  action: WorkflowActionType;
  stepKey?: string;
  targetStepKey?: string;
  depthMode?: 'standard' | 'deep';
}

export function parseWorkflowAction(data: Record<string, unknown>): WorkflowAction | null {
  const action = data.action as string | undefined;
  if (!action) return null;

  switch (action) {
    case 'start':
      return { action: 'start', targetStepKey: data.targetStepKey as string | undefined };
    case 'continue':
      return { action: 'continue', stepKey: data.stepKey as string | undefined };
    case 'stop':
      return { action: 'stop' };
    case 'retry':
      return { action: 'retry', stepKey: data.stepKey as string | undefined };
    case 'select_target':
      return { action: 'select_target', targetStepKey: data.targetStepKey as string | undefined };
    case 'select_depth':
      return { action: 'select_depth', depthMode: (data.depthMode as 'standard' | 'deep') ?? 'standard' };
    default:
      return null;
  }
}
