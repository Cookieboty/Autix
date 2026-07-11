import {
  tasksApi,
  type TaskModel,
  type QuoteTaskResult,
} from '@autix/sdk';

export type { TaskModel, QuoteTaskResult } from '@autix/sdk';

export interface QuoteTaskInput {
  modelConfigId?: string;
  params: Record<string, unknown>;
  usage?: Record<string, unknown>;
}

export const pricingActions = {
  getTaskModels: async (taskType: string): Promise<TaskModel[]> => {
    const res = await tasksApi.listModels(taskType);
    return res.data;
  },
  quoteTask: async (taskType: string, input: QuoteTaskInput): Promise<QuoteTaskResult> => {
    const res = await tasksApi.quote(taskType, input);
    return res.data;
  },
};
