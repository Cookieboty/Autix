import { membershipApi, orderApi, pointsApi } from '@autix/sdk';
import type {
  MembershipInfo,
  MembershipLevel,
  Order,
  PointsBalance,
  PointsPackage,
} from '@autix/domain/billing';

export type {
  MembershipInfo,
  MembershipLevel,
  Order,
  PointsBalance,
  PointsPackage,
};

export interface MembershipLevelsResult {
  levels: MembershipLevel[];
  isFirstTime: boolean;
}

export interface CreateMembershipOrderInput {
  orderType: 'MEMBERSHIP' | 'POINTS_PACKAGE';
  productId: string;
}

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
  createStripeCheckout: (input: CreateMembershipOrderInput) =>
    orderApi.createStripeCheckout(input),
};
