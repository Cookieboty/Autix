import { campaignApi, inviteApi, membershipApi, orderApi, pointsApi } from '@autix/sdk';
import type {
  MembershipInfo,
  MembershipLevel,
  MembershipPlan,
  Order,
  PointsBalance,
  PointsPackage,
  PointsRecord,
} from '@autix/domain/billing';
import type {
  CampaignProgress,
  InviteCode,
  InviteRecord,
  PaginatedResult,
  PointAccountSummary,
  StripeCheckoutResult,
  UserActivityStreak,
} from '@autix/sdk';

export type {
  MembershipInfo,
  MembershipLevel,
  MembershipPlan,
  Order,
  PointsBalance,
  PointsPackage,
  PointsRecord,
  CampaignProgress,
  InviteCode,
  InviteRecord,
  PointAccountSummary,
  PaginatedResult,
  UserActivityStreak,
};

export type MembershipStripeCheckoutResult = Omit<StripeCheckoutResult, 'order'> & {
  order: Order;
};

export type MembershipStripeCheckoutSyncResult = {
  order: Order;
  sessionId: string;
  paymentStatus?: string | null;
  sessionStatus?: string | null;
  synced: boolean;
};

export interface MembershipLevelsResult {
  levels: MembershipLevel[];
  isFirstTime: boolean;
}

export interface CreateMembershipOrderInput {
  orderType: 'MEMBERSHIP' | 'POINTS_PACKAGE';
  productId: string;
}

export interface MembershipOrderParams {
  page?: number;
  pageSize?: number;
  status?: string;
  orderType?: string;
}

export interface MembershipPointsRecordParams {
  page?: number;
  pageSize?: number;
  source?: string;
}

export interface MembershipInviteOverview {
  code: InviteCode | null;
  records: InviteRecord[];
}

const toPaginated = <T>(
  data: PaginatedResult<T> | T[] | unknown,
  fallback: Required<Pick<PaginatedResult<T>, 'page' | 'pageSize'>>,
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

function normalizeOrder(order: import('@autix/sdk').Order): Order {
  return {
    ...order,
    currency: order.currency ?? 'USD',
    productId: order.productId ?? null,
    productName: order.productName ?? '',
  };
}

export const membershipUserActions = {
  listPublicLevels: async (): Promise<MembershipLevel[]> => {
    const { data } = await membershipApi.getPublicLevels();
    return Array.isArray(data) ? data : [];
  },
  listLevels: async (): Promise<MembershipLevelsResult> => {
    const { data } = await membershipApi.getLevels();
    return data;
  },
  getMe: async (): Promise<MembershipInfo> => {
    const { data } = await membershipApi.getMe();
    return data;
  },
  cancelAtPeriodEnd: async (): Promise<MembershipInfo['membership']> => {
    const { data } = await membershipApi.cancelAtPeriodEnd();
    return data;
  },
  createBillingPortal: async (): Promise<{ url: string }> => {
    const { data } = await membershipApi.createBillingPortal();
    return data;
  },
  getRewardsProgress: async (): Promise<CampaignProgress> => {
    const { data } = await campaignApi.getMyProgress();
    return data;
  },
  getPointsBalance: async (): Promise<PointsBalance> => {
    const { data } = await pointsApi.getBalance();
    return data;
  },
  listPointsPackages: async (): Promise<PointsPackage[]> => {
    const { data } = await pointsApi.getPackages();
    return Array.isArray(data) ? data : [];
  },
  getPointsSummary: async (): Promise<PointAccountSummary> => {
    const { data } = await pointsApi.getSummary();
    return data;
  },
  listPointsRecords: async (
    params: MembershipPointsRecordParams = {},
  ): Promise<PaginatedResult<PointsRecord>> => {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const { data } = await pointsApi.getRecords({ ...params, page, pageSize });
    return toPaginated<PointsRecord>(data, { page, pageSize });
  },
  listOrders: async (
    params: MembershipOrderParams = {},
  ): Promise<PaginatedResult<Order>> => {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const { data } = await orderApi.list({ ...params, page, pageSize });
    const result = toPaginated<import('@autix/sdk').Order>(data, { page, pageSize });
    return {
      ...result,
      items: result.items.map(normalizeOrder),
    };
  },
  cancelOrder: async (id: string): Promise<Order> => {
    const { data } = await orderApi.cancel(id);
    return normalizeOrder(data);
  },
  getOrderById: async (id: string): Promise<Order> => {
    const { data } = await orderApi.getById(id);
    return normalizeOrder(data);
  },
  createStripeCheckout: async (
    input: CreateMembershipOrderInput,
  ): Promise<MembershipStripeCheckoutResult> => {
    const { data } = await orderApi.createStripeCheckout(input);
    return {
      ...data,
      order: normalizeOrder(data.order),
    };
  },
  syncStripeCheckout: async (
    sessionId: string,
  ): Promise<MembershipStripeCheckoutSyncResult> => {
    const { data } = await orderApi.syncStripeCheckout({ sessionId });
    return {
      ...data,
      order: normalizeOrder(data.order),
    };
  },
  createStripeCheckoutForOrder: async (
    id: string,
  ): Promise<MembershipStripeCheckoutResult> => {
    const { data } = await orderApi.createStripeCheckoutForOrder(id);
    return {
      ...data,
      order: normalizeOrder(data.order),
    };
  },
  getInviteCode: async (): Promise<InviteCode | null> => {
    const { data } = await inviteApi.getCode();
    return data ?? null;
  },
  listInviteRecords: async (): Promise<InviteRecord[]> => {
    const { data } = await inviteApi.getRecords();
    return Array.isArray(data) ? data : [];
  },
  getInviteOverview: async (): Promise<MembershipInviteOverview> => {
    const [codeRes, recordsRes] = await Promise.allSettled([
      inviteApi.getCode(),
      inviteApi.getRecords(),
    ]);
    return {
      code: codeRes.status === 'fulfilled' ? codeRes.value.data ?? null : null,
      records:
        recordsRes.status === 'fulfilled' && Array.isArray(recordsRes.value.data)
          ? recordsRes.value.data
          : [],
    };
  },
};
