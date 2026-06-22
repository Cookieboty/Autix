import {
  membershipAdminApi,
  type AdminAuditEntry,
  type AdminAuditLogPage,
  type AdminUserPointsDetail,
  type Campaign,
  type CampaignReward,
  type CampaignStatus,
  type CampaignType,
  type PaginatedResult,
  type UpsertCampaignInput,
} from '@autix/sdk';
import type {
  AdminMembershipUser,
  GenerationPricingRule,
  MembershipLevel,
  MembershipPlan,
  Order,
  PointsPackage,
  PointsRecord,
  PricingRuleComponent,
  PricingRuleComponentType,
  PricingRulePreviewResult,
} from '@autix/domain/billing';

export type {
  AdminMembershipUser,
  AdminAuditEntry,
  AdminAuditLogPage,
  AdminUserPointsDetail,
  Campaign,
  CampaignReward,
  CampaignStatus,
  CampaignType,
  GenerationPricingRule,
  MembershipLevel,
  MembershipPlan,
  Order,
  PointsPackage,
  PointsRecord,
  PricingRuleComponent,
  PricingRuleComponentType,
  PricingRulePreviewResult,
  UpsertCampaignInput,
};

export interface AdminMembershipListParams {
  page?: number;
  pageSize?: number;
}

export interface AdminMembershipOrderParams extends AdminMembershipListParams {
  userId?: string;
  status?: string;
  orderType?: string;
}

export interface AdminMembershipPointsParams extends AdminMembershipListParams {
  userId?: string;
  source?: string;
}

export interface AdminMembershipUsersParams extends AdminMembershipListParams {
  search?: string;
}

export interface AdminMembershipGrantInput {
  userId: string;
  levelId: string;
  months?: number;
}

export interface AdminPointsGrantInput {
  userId: string;
  points?: number;
  remark?: string;
  packageId?: string;
}

export interface AdminOrderFulfillInput {
  id: string;
  userId?: string;
  confirm: 'CONFIRM_MANUAL_FULFILL';
  externalPaymentId?: string;
  amount?: string | number;
  currency?: string;
  remark?: string;
}

export interface AdminOrderRefundInput {
  id: string;
  userId?: string;
  confirm: 'CONFIRM_REFUND';
  externalRefundId?: string;
  amount?: string | number;
  currency?: string;
  reclaimPoints?: boolean;
  maxPointsToReclaim?: number;
  reason?: string;
  remark?: string;
}

export interface AdminUserPointsDetailParams {
  grantTake?: number;
  holdTake?: number;
  recordTake?: number;
}

export interface AdminAuditLogParams {
  action?: string;
  actorId?: string;
  limit?: number;
  cursor?: number;
}

export interface AdminCampaignRewardsParams {
  take?: number;
}

export interface AdminCampaignMutationInput {
  id: string;
  data: UpsertCampaignInput;
}

export interface AdminCampaignGrantOnceInput {
  campaignId: string;
  userId: string;
}

const toArray = <T>(data: T[] | { items?: T[] } | unknown): T[] => {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && 'items' in data && Array.isArray(data.items)) {
    return data.items;
  }
  return [];
};

const toPaginated = <T>(
  data: PaginatedResult<T> | T[] | unknown,
  fallback: Required<AdminMembershipListParams>,
): PaginatedResult<T> => {
  if (data && typeof data === 'object' && 'items' in data && Array.isArray(data.items)) {
    const source = data as Partial<PaginatedResult<T>> & { items: T[] };
    return {
      items: source.items,
      total: source.total ?? source.items.length,
      page: source.page ?? fallback.page,
      pageSize: source.pageSize ?? fallback.pageSize,
      hasMore: source.hasMore ?? false,
    };
  }

  const items = Array.isArray(data) ? data : [];
  return {
    items,
    total: items.length,
    page: fallback.page,
    pageSize: fallback.pageSize,
    hasMore: false,
  };
};

export const membershipAdminActions = {
  listLevels: async () => {
    const { data } = await membershipAdminApi.getLevels();
    return toArray<MembershipLevel>(data);
  },
  createLevel: (data: Record<string, unknown>) =>
    membershipAdminApi.createLevel(data),
  updateLevel: (id: string, data: Record<string, unknown>) =>
    membershipAdminApi.updateLevel(id, data),
  deleteLevel: (id: string) =>
    membershipAdminApi.deleteLevel(id),
  createPlan: (data: Record<string, unknown>) =>
    membershipAdminApi.createPlan(data),
  updatePlan: (id: string, data: Record<string, unknown>) =>
    membershipAdminApi.updatePlan(id, data),
  deletePlan: (id: string) =>
    membershipAdminApi.deletePlan(id),

  listPackages: async () => {
    const { data } = await membershipAdminApi.getPackages();
    return toArray<PointsPackage>(data);
  },
  createPackage: (data: Record<string, unknown>) =>
    membershipAdminApi.createPackage(data),
  updatePackage: (id: string, data: Record<string, unknown>) =>
    membershipAdminApi.updatePackage(id, data),

  listPricingRules: async () => {
    const { data } = await membershipAdminApi.getPricingRules();
    return toArray<GenerationPricingRule>(data);
  },
  createPricingRule: (data: Record<string, unknown>) =>
    membershipAdminApi.createPricingRule(data),
  updatePricingRule: (id: string, data: Record<string, unknown>) =>
    membershipAdminApi.updatePricingRule(id, data),
  previewPricingRule: (data: Record<string, unknown>) =>
    membershipAdminApi.previewPricingRule(data),

  listOrders: async (params: AdminMembershipOrderParams = {}) => {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 15;
    const { data } = await membershipAdminApi.getOrders({ ...params, page, pageSize });
    return toPaginated<Order>(data, { page, pageSize });
  },
  fulfillOrder: ({ id, userId: _userId, ...data }: AdminOrderFulfillInput) =>
    membershipAdminApi.fulfillOrder(id, data),
  refundOrder: ({ id, userId: _userId, ...data }: AdminOrderRefundInput) =>
    membershipAdminApi.refundOrder(id, data),

  listPointsRecords: async (params: AdminMembershipPointsParams = {}) => {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 15;
    const { data } = await membershipAdminApi.getPointsRecords({
      ...params,
      page,
      pageSize,
    });
    return toPaginated<PointsRecord>(data, { page, pageSize });
  },

  listUsers: async (params: AdminMembershipUsersParams = {}) => {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const { data } = await membershipAdminApi.getUsers({ ...params, page, pageSize });
    return toPaginated<AdminMembershipUser>(data, { page, pageSize });
  },
  getUserDetail: async (userId: string) => {
    const { data } = await membershipAdminApi.getUserDetail(userId);
    return data;
  },
  getUserPointsDetail: async (
    userId: string,
    params?: AdminUserPointsDetailParams,
  ) => {
    const { data } = await membershipAdminApi.getUserPointsDetail(userId, params);
    return data;
  },
  grantMembership: ({ userId, levelId, months }: AdminMembershipGrantInput) =>
    membershipAdminApi.grantMembership(userId, { levelId, months }),
  grantPoints: ({ userId, points, remark, packageId }: AdminPointsGrantInput) =>
    membershipAdminApi.grantPoints(userId, { points, remark, packageId }),
  approveUser: (userId: string, data?: { note?: string }) =>
    membershipAdminApi.approveUser(userId, data),

  listAuditLogs: async (params: AdminAuditLogParams = {}) => {
    const { data } = await membershipAdminApi.getAuditLogs(params);
    return data;
  },

  listCampaigns: async () => {
    const { data } = await membershipAdminApi.getCampaigns();
    return toArray<Campaign>(data);
  },
  createCampaign: async (data: UpsertCampaignInput) => {
    const response = await membershipAdminApi.createCampaign(data);
    return response.data;
  },
  updateCampaign: async ({ id, data }: AdminCampaignMutationInput) => {
    const response = await membershipAdminApi.updateCampaign(id, data);
    return response.data;
  },
  listCampaignRewards: async (
    campaignId: string,
    params?: AdminCampaignRewardsParams,
  ) => {
    const { data } = await membershipAdminApi.getCampaignRewards(campaignId, params);
    return toArray<CampaignReward>(data);
  },
  grantCampaignOnce: ({ campaignId, userId }: AdminCampaignGrantOnceInput) =>
    membershipAdminApi.grantCampaignOnce(campaignId, { userId }),
};
