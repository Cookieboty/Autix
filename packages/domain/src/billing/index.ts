export interface MembershipInfo {
  membership: UserMembership | null;
  pointsBalance: number;
}

export interface UserMembership {
  id: string;
  userId: string;
  levelId: string;
  planId: string | null;
  autoRenew: boolean;
  startedAt: string;
  expiresAt: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  cancelAtPeriodEnd?: boolean;
  cancelledAt?: string | null;
  pendingPlanId?: string | null;
  pendingOrderId?: string | null;
  pendingLevelId?: string | null;
  pendingBillingCycle?: 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | null;
  pendingAutoRenew?: boolean | null;
  pendingChangeEffectiveAt?: string | null;
  pendingChangeRequestedAt?: string | null;
}

export interface PointsBalance {
  userId: string;
  balance: number;
  availableBalance?: number;
  frozenBalance?: number;
  totalBalance?: number;
  subscriptionBalance?: number;
  purchasedBalance?: number;
  giftBalance?: number;
  compensationBalance?: number;
}

export interface PointsRecord {
  id: string;
  userId: string;
  type: 'EARN' | 'CONSUME';
  amount: number;
  source:
    | 'MEMBERSHIP'
    | 'PACKAGE'
    | 'TASK'
    | 'INVITATION'
    | 'ADMIN_GRANT'
    | 'AGENT_CALL'
    | 'CAMPAIGN'
    | 'EXPIRATION';
  sourceId: string | null;
  balance: number;
  remark: string | null;
  status?: 'PENDING' | 'CONFIRMED' | 'REFUNDED';
  holdId?: string | null;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNo: string;
  userId: string;
  orderType: string;
  status: string;
  amount: string;
  currency: string;
  productId: string | null;
  createdAt: string;
  paidAt?: string | null;
  fulfilledAt?: string | null;
}
