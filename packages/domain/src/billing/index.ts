export interface MembershipInfo {
  membership: UserMembership | null;
  pointsBalance: number;
}

export interface UserMembership {
  id: string;
  userId: string;
  levelId: string;
  level: MembershipLevel;
  planId: string | null;
  autoRenew: boolean;
  startedAt: string;
  expiresAt: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  cancelAtPeriodEnd?: boolean;
  cancelledAt?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  pendingPlanId?: string | null;
  pendingOrderId?: string | null;
  pendingLevelId?: string | null;
  pendingBillingCycle?: 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | null;
  pendingAutoRenew?: boolean | null;
  pendingChangeEffectiveAt?: string | null;
  pendingChangeRequestedAt?: string | null;
}

export interface MembershipLevel {
  id: string;
  name: string;
  level: number;
  monthlyPrice: string;
  pointsPerMonth: number;
  features: string[] | Record<string, unknown> | null;
  isActive?: boolean;
  sort?: number;
  plans: MembershipPlan[];
}

export interface MembershipPlan {
  id: string;
  levelId: string;
  billingCycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  months: number;
  autoRenew: boolean;
  originalPrice: string;
  price: string;
  firstTimePrice: string | null;
  discountLabel: string | null;
  firstTimeLabel: string | null;
  points: number;
  isActive?: boolean;
  sort?: number;
}

export interface PointsPackage {
  id: string;
  code?: string | null;
  name: string;
  description?: string | null;
  price: string;
  points: number;
  validityDays?: number;
  usageScope?: Record<string, unknown> | null;
  showCommercialLicense?: boolean;
  isActive?: boolean;
  sort?: number;
}

export type PricingRuleComponentType =
  | 'base'
  | 'fixed_extra'
  | 'per_image'
  | 'per_second'
  | 'input_token_per_1k'
  | 'output_token_per_1k'
  | 'context_token_per_1k'
  | 'per_tool_call'
  | 'per_mcp_call'
  | 'per_skill_call'
  | 'per_batch'
  | 'per_reference_image'
  | 'reasoning_multiplier'
  | 'reference_image_multiplier'
  | 'video_input_multiplier'
  | 'audio_input_multiplier'
  | 'priority_multiplier';

export interface PricingRuleComponent {
  id?: string;
  ruleId?: string;
  componentType: PricingRuleComponentType;
  unitCost?: string | number | null;
  multiplier?: string | number | null;
  config?: Record<string, unknown> | null;
  sort?: number;
  isActive?: boolean;
}

export interface GenerationPricingRule {
  id: string;
  taskType: string;
  name: string;
  baseUnit: string;
  priority?: number;
  conditions?: Record<string, unknown> | null;
  refundPolicy?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  components?: PricingRuleComponent[];
  isActive: boolean;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PricingRulePreviewResult {
  estimate: {
    estimatedCost: number;
    breakdown: Array<{ label: string; amount: number }>;
    ruleId: string;
    [key: string]: unknown;
  } | null;
  estimateError: string | null;
  matchedRule: GenerationPricingRule | null;
  warnings: Array<{
    code: string;
    message: string;
    field?: string;
  }>;
}

export interface AdminMembershipUser {
  id: string;
  username: string;
  email: string;
  status: string;
  membership?: {
    level?: { id: string; name: string };
    expiresAt?: string;
  } | null;
  pointsBalance: number;
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
  businessType?: string | null;
  status: string;
  amount: string;
  paidAmount?: string | null;
  currency: string;
  productId: string | null;
  productName?: string;
  fulfilledAt?: string | null;
  refundedAt?: string | null;
  createdAt: string;
  paidAt?: string | null;
}
