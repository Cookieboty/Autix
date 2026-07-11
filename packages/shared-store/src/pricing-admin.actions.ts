import {
  adminPricingApi,
  type AdminModelDescription,
  type AdminModelDetail,
  type AdminModelSchemas,
  type AdminTaskCategory,
  type AdminTaskDefinition,
  type CreateDiscountInput,
  type CreateTaskDefinitionInput,
  type CreateTaskModelBindingInput,
  type DryRunPricingInput,
  type DryRunResult,
  type LocalizedText,
  type ParamsSchema,
  type PricingDiscount,
  type PricingDiscountScope,
  type PricingSchema,
  type TaskModelBinding,
  type UpdateDiscountInput,
  type UpdateModelDescriptionInput,
  type UpdateModelSchemasInput,
  type UpdateTaskDefinitionInput,
  type UpdateTaskModelBindingInput,
} from '@autix/sdk';

/**
 * Re-exported for the phase-3 admin pricing views (packages/shared-ui/src/admin/pricing/*),
 * which import model/task/binding/discount types from `@autix/shared-store` rather than reaching
 * into `@autix/sdk` directly. `AdminTaskDefinition` is re-exported as `TaskDefinition` — the sdk's
 * own `TaskDefinition` name is already taken by the public `/api/tasks` shape (fewer fields, no
 * fixedCostSchema/timestamps), so the two can't share a name inside packages/sdk/src/client.ts.
 */
export type {
  AdminModelDescription,
  AdminModelDetail,
  AdminModelSchemas,
  AdminTaskCategory,
  AdminTaskDefinition as TaskDefinition,
  CreateDiscountInput,
  CreateTaskDefinitionInput,
  CreateTaskModelBindingInput,
  DryRunPricingInput,
  DryRunResult,
  LocalizedText,
  ParamsSchema,
  PricingDiscount,
  PricingDiscountScope,
  PricingSchema,
  TaskModelBinding,
  UpdateDiscountInput,
  UpdateModelDescriptionInput,
  UpdateModelSchemasInput,
  UpdateTaskDefinitionInput,
  UpdateTaskModelBindingInput,
};

export const pricingAdminActions = {
  // -- models --
  getModel: async (id: string): Promise<AdminModelDetail> => {
    const res = await adminPricingApi.getModel(id);
    return res.data;
  },
  updateModelSchemas: async (
    id: string,
    data: UpdateModelSchemasInput,
  ): Promise<AdminModelSchemas> => {
    const res = await adminPricingApi.updateModelSchemas(id, data);
    return res.data;
  },
  updateModelDescription: async (
    id: string,
    data: UpdateModelDescriptionInput,
  ): Promise<AdminModelDescription> => {
    const res = await adminPricingApi.updateModelDescription(id, data);
    return res.data;
  },
  dryRunPricing: async (data: DryRunPricingInput): Promise<DryRunResult> => {
    const res = await adminPricingApi.dryRunPricing(data);
    return res.data;
  },

  // -- task definitions --
  listTaskDefinitions: async (): Promise<AdminTaskDefinition[]> => {
    const res = await adminPricingApi.listTaskDefinitions();
    return res.data;
  },
  createTaskDefinition: async (
    data: CreateTaskDefinitionInput,
  ): Promise<AdminTaskDefinition> => {
    const res = await adminPricingApi.createTaskDefinition(data);
    return res.data;
  },
  updateTaskDefinition: async (
    taskType: string,
    data: UpdateTaskDefinitionInput,
  ): Promise<AdminTaskDefinition> => {
    const res = await adminPricingApi.updateTaskDefinition(taskType, data);
    return res.data;
  },
  deleteTaskDefinition: async (taskType: string): Promise<AdminTaskDefinition> => {
    const res = await adminPricingApi.deleteTaskDefinition(taskType);
    return res.data;
  },

  // -- task-model bindings --
  listTaskModelBindings: async (taskType?: string): Promise<TaskModelBinding[]> => {
    const res = await adminPricingApi.listTaskModelBindings(taskType);
    return res.data;
  },
  createTaskModelBinding: async (
    data: CreateTaskModelBindingInput,
  ): Promise<TaskModelBinding> => {
    const res = await adminPricingApi.createTaskModelBinding(data);
    return res.data;
  },
  updateTaskModelBinding: async (
    taskType: string,
    modelConfigId: string,
    data: UpdateTaskModelBindingInput,
  ): Promise<TaskModelBinding> => {
    const res = await adminPricingApi.updateTaskModelBinding(taskType, modelConfigId, data);
    return res.data;
  },
  deleteTaskModelBinding: async (
    taskType: string,
    modelConfigId: string,
  ): Promise<TaskModelBinding> => {
    const res = await adminPricingApi.deleteTaskModelBinding(taskType, modelConfigId);
    return res.data;
  },

  // -- discounts --
  listDiscounts: async (): Promise<PricingDiscount[]> => {
    const res = await adminPricingApi.listDiscounts();
    return res.data;
  },
  createDiscount: async (data: CreateDiscountInput): Promise<PricingDiscount> => {
    const res = await adminPricingApi.createDiscount(data);
    return res.data;
  },
  updateDiscount: async (id: string, data: UpdateDiscountInput): Promise<PricingDiscount> => {
    const res = await adminPricingApi.updateDiscount(id, data);
    return res.data;
  },
  deleteDiscount: async (id: string): Promise<PricingDiscount> => {
    const res = await adminPricingApi.deleteDiscount(id);
    return res.data;
  },
};
