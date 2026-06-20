import { membershipApi, orderApi, pointsApi } from '@autix/sdk';
import type {
  MembershipInfo,
  MembershipLevel,
  Order,
  PointsBalance,
  PointsPackage,
  PointsRecord,
} from '@autix/domain/billing';
import type {
  PaginatedResult,
  PointAccountSummary,
  StripeCheckoutResult,
} from '@autix/sdk';

export type {
  MembershipInfo,
  MembershipLevel,
  Order,
  PointsBalance,
  PointsPackage,
  PointsRecord,
  PointAccountSummary,
  PaginatedResult,
  StripeCheckoutResult,
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

export const membershipUserActions = {
  listLevels: async (): Promise<MembershipLevelsResult> => {
    const { data } = await membershipApi.getLevels();
    return data;
  },
  getMe: async (): Promise<MembershipInfo> => {
    const { data } = await membershipApi.getMe();
    return data;
  },
  cancelAtPeriodEnd: () => membershipApi.cancelAtPeriodEnd(),
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
    return toPaginated<Order>(data, { page, pageSize });
  },
  cancelOrder: (id: string) => orderApi.cancel(id),
  createStripeCheckout: async (
    input: CreateMembershipOrderInput,
  ): Promise<StripeCheckoutResult> => {
    const { data } = await orderApi.createStripeCheckout(input);
    return data;
  },
  createStripeCheckoutForOrder: async (
    id: string,
  ): Promise<StripeCheckoutResult> => {
    const { data } = await orderApi.createStripeCheckoutForOrder(id);
    return data;
  },
};
