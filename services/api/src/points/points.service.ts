import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  PointGrantType,
  PointHoldStatus,
  PointLedgerEventType,
  PricingBaseUnit,
  PointsSource,
  Prisma,
} from '../prisma/generated';

type PointGrantRecord = {
  id: string;
  grantType: PointGrantType;
  availableAmount: number;
  frozenAmount: number;
  expiresAt: Date | null;
  usageScope?: Prisma.JsonValue | null;
};

const GRANT_TYPE_BALANCE_FIELD: Record<PointGrantType, keyof Prisma.user_pointsUpdateInput> = {
  SUBSCRIPTION: 'subscriptionBalance',
  PURCHASED: 'purchasedBalance',
  GIFT: 'giftBalance',
  COMPENSATION: 'compensationBalance',
};

const GRANT_TYPE_PRIORITY: Record<PointGrantType, number> = {
  GIFT: 0,
  SUBSCRIPTION: 1,
  COMPENSATION: 2,
  PURCHASED: 3,
};

const SOURCE_TO_GRANT: Partial<Record<PointsSource, PointGrantType>> = {
  MEMBERSHIP: PointGrantType.SUBSCRIPTION,
  PACKAGE: PointGrantType.PURCHASED,
  INVITATION: PointGrantType.GIFT,
  CAMPAIGN: PointGrantType.GIFT,
  ADMIN_GRANT: PointGrantType.COMPENSATION,
};

const SOURCE_TO_EVENT: Partial<Record<PointsSource, PointLedgerEventType>> = {
  MEMBERSHIP: PointLedgerEventType.subscription_grant,
  PACKAGE: PointLedgerEventType.points_purchase,
  INVITATION: PointLedgerEventType.campaign_bonus,
  CAMPAIGN: PointLedgerEventType.campaign_bonus,
  ADMIN_GRANT: PointLedgerEventType.admin_adjustment,
};

interface GrantPointsInput {
  amount: number;
  grantType: PointGrantType;
  sourceEvent: PointLedgerEventType;
  sourceId?: string;
  expiresAt?: Date | null;
  usageScope?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
  source?: PointsSource;
  remark?: string;
}

interface CreateHoldInput {
  taskType: string;
  taskId?: string;
  source?: PointsSource;
  amount: number;
  pricingSnapshot?: Prisma.InputJsonValue;
  refundPolicySnapshot?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
  remark?: string;
}

interface FindHoldByTaskInput {
  taskType?: string;
  taskId: string;
}

export interface EstimateCostInput {
  taskType: string;
  modelProvider?: string;
  modelName?: string;
  quality?: string;
  resolution?: string;
  modelTier?: string;
  quantity?: number;
  seconds?: number;
  inputTokens?: number;
  outputTokens?: number;
  contextTokens?: number;
  toolCalls?: number;
  batchCount?: number;
  referenceImages?: number;
  hasVideoInput?: boolean;
  hasAudioInput?: boolean;
  priority?: boolean;
  // P1-2: 可选上下文，传入后会在规则匹配阶段强制校验
  membershipLevel?: number;
  grantType?: PointGrantType;
}

@Injectable()
export class PointsService {
  constructor(private readonly prisma: PrismaService) { }

  async getBalance(userId: string) {
    return this.prisma.user_points.upsert({
      where: { userId },
      create: { userId, balance: 0, availableBalance: 0, totalBalance: 0 },
      update: {},
    });
  }

  async getAccountSummary(userId: string) {
    const [account, grants] = await Promise.all([
      this.getBalance(userId),
      this.prisma.point_grants.findMany({
        where: {
          userId,
          OR: [{ availableAmount: { gt: 0 } }, { frozenAmount: { gt: 0 } }],
        },
        orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);

    return {
      account,
      grants,
      balances: {
        available: account.availableBalance,
        frozen: account.frozenBalance,
        total: account.totalBalance,
        subscription: account.subscriptionBalance,
        purchased: account.purchasedBalance,
        gift: account.giftBalance,
        compensation: account.compensationBalance,
      },
    };
  }

  async getRecords(
    userId: string,
    query: { page?: number; pageSize?: number; source?: PointsSource },
  ) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 50);
    const skip = (page - 1) * pageSize;

    const where: any = { userId, status: 'CONFIRMED' };
    if (query.source) where.source = query.source;

    const [items, total] = await Promise.all([
      this.prisma.points_records.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.points_records.count({ where }),
    ]);

    return { items, total, page, pageSize, hasMore: skip + items.length < total };
  }

  async getPackages() {
    return this.prisma.points_packages.findMany({
      where: { isActive: true },
      orderBy: { sort: 'asc' },
    });
  }

  async getTaskCosts() {
    return this.prisma.generation_pricing_rules.findMany({
      where: { isActive: true },
      orderBy: [{ taskType: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async getPricingRules() {
    return this.prisma.generation_pricing_rules.findMany({
      where: { isActive: true },
      orderBy: [{ taskType: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async estimateCost(input: EstimateCostInput) {
    const now = new Date();
    const candidates = await this.prisma.generation_pricing_rules.findMany({
      where: {
        taskType: input.taskType,
        isActive: true,
        OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }],
        AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] }],
      },
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
    });
    const rule = candidates.find((candidate) => this.pricingRuleMatches(candidate, input));
    if (!rule) {
      throw new BadRequestException(`未配置计费规则: ${input.taskType}`);
    }

    // P1-2: baseUnit 互斥分派，先算出基础项 + 与基础单位强相关的"主项"
    const items: Array<{ label: string; amount: number }> = [];
    let subtotal = 0;
    switch (rule.baseUnit) {
      case PricingBaseUnit.image: {
        const quantity = Math.max(1, input.quantity ?? 1);
        const amount = rule.baseCost * quantity;
        subtotal += amount;
        if (amount > 0) items.push({ label: 'imageQuantity', amount });
        break;
      }
      case PricingBaseUnit.second: {
        const seconds = Math.max(1, input.seconds ?? 1);
        const amount = rule.baseCost * seconds;
        subtotal += amount;
        if (amount > 0) items.push({ label: 'seconds', amount });
        break;
      }
      default: {
        // token / message / tool_call 等：基础成本视为"每次调用基础费"
        if (rule.baseCost > 0) {
          subtotal += rule.baseCost;
          items.push({ label: 'baseCost', amount: rule.baseCost });
        }
        break;
      }
    }

    // P1-2: 统一附加项（与 baseUnit 解耦），任意 baseUnit 都可叠加
    if (rule.fixedExtraCost > 0) {
      subtotal += rule.fixedExtraCost;
      items.push({ label: 'fixedExtraCost', amount: rule.fixedExtraCost });
    }

    const inputTokenCost = this.tokenCost(input.inputTokens, rule.inputTokenCostPerK);
    const outputTokenCost = this.tokenCost(input.outputTokens, rule.outputTokenCostPerK);
    const contextTokenCost = this.tokenCost(input.contextTokens, rule.contextTokenCostPerK);
    subtotal += inputTokenCost + outputTokenCost + contextTokenCost;
    if (inputTokenCost > 0) items.push({ label: 'inputTokens', amount: inputTokenCost });
    if (outputTokenCost > 0) items.push({ label: 'outputTokens', amount: outputTokenCost });
    if (contextTokenCost > 0) items.push({ label: 'contextTokens', amount: contextTokenCost });

    if (rule.toolCallCost && input.toolCalls) {
      const amount = rule.toolCallCost * input.toolCalls;
      subtotal += amount;
      items.push({ label: 'toolCalls', amount });
    }
    if (rule.batchUnitCost && input.batchCount) {
      const amount = rule.batchUnitCost * input.batchCount;
      subtotal += amount;
      items.push({ label: 'batchCount', amount });
    }
    if (rule.referenceImageFixedCost && input.referenceImages) {
      const amount = rule.referenceImageFixedCost * input.referenceImages;
      subtotal += amount;
      items.push({ label: 'referenceImages', amount });
    }

    // P1-2: 统一倍率附加，乘法约定 = 顺序连乘（叠加而非二选一）
    let multiplier = Number(rule.reasoningMultiplier ?? 1) || 1;
    if (rule.referenceImageMultiplier && input.referenceImages) {
      multiplier *= Number(rule.referenceImageMultiplier);
    }
    if (rule.videoInputMultiplier && input.hasVideoInput) {
      multiplier *= Number(rule.videoInputMultiplier);
    }
    if (rule.audioInputMultiplier && input.hasAudioInput) {
      multiplier *= Number(rule.audioInputMultiplier);
    }
    if (rule.priorityMultiplier && input.priority) {
      multiplier *= Number(rule.priorityMultiplier);
    }

    const estimatedCost = Math.ceil(subtotal * multiplier);
    return {
      estimatedCost,
      ruleId: rule.id,
      taskType: rule.taskType,
      ruleName: rule.name,
      baseUnit: rule.baseUnit,
      multiplier,
      items,
      pricingSnapshot: {
        ruleId: rule.id,
        taskType: rule.taskType,
        name: rule.name,
        input,
        items,
        multiplier,
        estimatedCost,
      },
      refundPolicy: rule.refundPolicy,
    };
  }

  // P2-B: 规则预览 / 诊断入口。
  // 与 estimateCost 解耦：即便规则未命中也不抛错，便于后台调试。
  // metaCheck 给出告警，便于运营在保存规则前发现 0 价 / 负价 / 倍率/附加项缺失等问题。
  async previewPricingRule(input: EstimateCostInput) {
    const warnings: Array<{ code: string; message: string; field?: string }> = [];
    let estimate: Awaited<ReturnType<PointsService['estimateCost']>> | null = null;
    let estimateError: string | null = null;
    try {
      estimate = await this.estimateCost(input);
    } catch (error: any) {
      estimateError = error?.message ?? String(error);
    }

    const matchedRule = estimate
      ? await this.prisma.generation_pricing_rules.findUnique({ where: { id: estimate.ruleId } })
      : null;

    if (!matchedRule) {
      warnings.push({
        code: 'NO_RULE_MATCHED',
        message: estimateError ?? '未命中任何计费规则',
      });
    } else {
      if (matchedRule.baseCost < 0) {
        warnings.push({
          code: 'NEGATIVE_BASE_COST',
          message: `baseCost=${matchedRule.baseCost} 不允许为负数`,
          field: 'baseCost',
        });
      } else if (matchedRule.baseCost === 0) {
        warnings.push({
          code: 'ZERO_BASE_COST',
          message: '该规则 baseCost 为 0，确认是否符合预期',
          field: 'baseCost',
        });
      }

      if (matchedRule.fixedExtraCost != null && matchedRule.fixedExtraCost < 0) {
        warnings.push({
          code: 'NEGATIVE_FIXED_EXTRA_COST',
          message: `fixedExtraCost=${matchedRule.fixedExtraCost} 不允许为负数`,
          field: 'fixedExtraCost',
        });
      }

      const checkMultiplier = (label: string, raw: unknown) => {
        if (raw == null) return;
        const value = Number(raw);
        if (!Number.isFinite(value) || value < 0) {
          warnings.push({
            code: 'INVALID_MULTIPLIER',
            message: `${label} 取值非法: ${String(raw)}`,
            field: label,
          });
        }
      };
      checkMultiplier('reasoningMultiplier', matchedRule.reasoningMultiplier);
      checkMultiplier('referenceImageMultiplier', matchedRule.referenceImageMultiplier);
      checkMultiplier('videoInputMultiplier', matchedRule.videoInputMultiplier);
      checkMultiplier('audioInputMultiplier', matchedRule.audioInputMultiplier);
      checkMultiplier('priorityMultiplier', matchedRule.priorityMultiplier);

      if (matchedRule.baseUnit === PricingBaseUnit.image && (input.quantity ?? 0) <= 0) {
        warnings.push({
          code: 'MISSING_QUANTITY',
          message: 'baseUnit=image 但未提供有效的 quantity，将按 1 计算',
          field: 'quantity',
        });
      }
      if (matchedRule.baseUnit === PricingBaseUnit.second && (input.seconds ?? 0) <= 0) {
        warnings.push({
          code: 'MISSING_SECONDS',
          message: 'baseUnit=second 但未提供有效的 seconds，将按 1 计算',
          field: 'seconds',
        });
      }

      if (estimate && estimate.estimatedCost <= 0) {
        warnings.push({
          code: 'ZERO_ESTIMATED_COST',
          message: '当前输入下估算扣费为 0，请确认规则与入参',
        });
      }
    }

    return {
      estimate,
      estimateError,
      matchedRule,
      warnings,
    };
  }

  async getPackageById(id: string) {
    return this.prisma.points_packages.findUnique({ where: { id } });
  }

  async addPoints(
    userId: string,
    amount: number,
    source: PointsSource,
    sourceId?: string,
    remark?: string,
  ): Promise<number> {
    const grantType = SOURCE_TO_GRANT[source] ?? PointGrantType.COMPENSATION;
    const sourceEvent = SOURCE_TO_EVENT[source] ?? PointLedgerEventType.admin_adjustment;
    const grant = await this.grantPoints(userId, {
      amount,
      grantType,
      sourceEvent,
      source,
      sourceId,
      remark,
    });
    return grant.balance;
  }

  async grantPoints(userId: string, input: GrantPointsInput) {
    this.assertPositiveAmount(input.amount);

    return this.prisma.$transaction(async (tx) =>
      this.grantPointsWithinTx(tx, userId, input),
    );
  }

  async grantPointsWithinTx(
    tx: Prisma.TransactionClient,
    userId: string,
    input: GrantPointsInput,
  ) {
    this.assertPositiveAmount(input.amount);
    const source = input.source ?? this.eventToLegacySource(input.sourceEvent);
    const grant = await tx.point_grants.create({
      data: {
        userId,
        grantType: input.grantType,
        sourceEvent: input.sourceEvent,
        sourceId: input.sourceId,
        totalAmount: input.amount,
        availableAmount: input.amount,
        expiresAt: input.expiresAt ?? null,
        usageScope: input.usageScope,
        metadata: input.metadata,
      },
    });

    const points = await tx.user_points.upsert({
      where: { userId },
      create: {
        userId,
        balance: input.amount,
        availableBalance: input.amount,
        totalBalance: input.amount,
        [GRANT_TYPE_BALANCE_FIELD[input.grantType]]: input.amount,
      },
      update: {
        balance: { increment: input.amount },
        availableBalance: { increment: input.amount },
        totalBalance: { increment: input.amount },
        [GRANT_TYPE_BALANCE_FIELD[input.grantType]]: { increment: input.amount },
      },
    });

    await tx.points_records.create({
      data: {
        userId,
        type: 'EARN',
        amount: input.amount,
        source,
        sourceId: input.sourceId ?? grant.id,
        balance: points.balance,
        remark: input.remark ?? input.sourceEvent,
      },
    });

    return { grant, balance: points.balance };
  }

  async createHold(userId: string, input: CreateHoldInput) {
    this.assertPositiveAmount(input.amount);

    return this.prisma.$transaction(async (tx) => {
      const grants = await tx.point_grants.findMany({
        where: {
          userId,
          availableAmount: { gt: 0 },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }],
      });
      const usableGrants = grants.filter((grant) =>
        this.grantCanBeUsedForTask(grant, input.taskType),
      );
      const selected = this.selectGrantsForAmount(usableGrants, input.amount);

      const hold = await tx.point_holds.create({
        data: {
          userId,
          taskType: input.taskType,
          taskId: input.taskId,
          estimatedAmount: input.amount,
          status: PointHoldStatus.PENDING,
          pricingSnapshot: input.pricingSnapshot,
          refundPolicySnapshot: input.refundPolicySnapshot,
          metadata: input.metadata,
        },
      });

      for (const item of selected) {
        // P1-1: 条件守卫，仅当 availableAmount >= 待冻结数时才扣减；
        // 命中 0 行说明并发抢占已发生，抛错使整个事务回滚。
        const updated = await tx.point_grants.updateMany({
          where: { id: item.grant.id, availableAmount: { gte: item.amount } },
          data: {
            availableAmount: { decrement: item.amount },
            frozenAmount: { increment: item.amount },
          },
        });
        if (updated.count === 0) {
          throw new BadRequestException(
            `INSUFFICIENT_GRANT: grant=${item.grant.id} required=${item.amount}`,
          );
        }
        await tx.point_hold_items.create({
          data: {
            holdId: hold.id,
            grantId: item.grant.id,
            amount: item.amount,
            grantType: item.grant.grantType,
            expiresAt: item.grant.expiresAt,
          },
        });
      }

      const updatedPoints = await tx.user_points.updateMany({
        where: {
          userId,
          balance: { gte: input.amount },
          availableBalance: { gte: input.amount },
        },
        data: {
          balance: { decrement: input.amount },
          availableBalance: { decrement: input.amount },
          frozenBalance: { increment: input.amount },
        },
      });
      if (updatedPoints.count === 0) {
        throw new BadRequestException('积分余额不足');
      }
      const points = await tx.user_points.findUniqueOrThrow({ where: { userId } });

      await tx.points_records.create({
        data: {
          userId,
          type: 'CONSUME',
          amount: input.amount,
          source: input.source ?? PointsSource.TASK,
          sourceId: input.taskId ?? hold.id,
          balance: points.balance,
          status: 'PENDING',
          holdId: hold.id,
          remark: input.remark ?? `generation_freeze:${input.taskType}`,
        },
      });

      return { hold, balance: points.balance };
    });
  }

  async findPendingHoldByTask(input: FindHoldByTaskInput) {
    return this.prisma.point_holds.findFirst({
      where: {
        taskId: input.taskId,
        taskType: input.taskType,
        status: { in: [PointHoldStatus.PENDING, PointHoldStatus.PROCESSING] },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async confirmHold(holdId: string, actualAmount?: number) {
    return this.prisma.$transaction((tx) =>
      this.confirmHoldWithinTx(tx, holdId, actualAmount),
    );
  }

  async confirmHoldWithinTx(
    tx: Prisma.TransactionClient,
    holdId: string,
    actualAmount?: number,
  ) {
    if (
      actualAmount !== undefined &&
      (!Number.isInteger(actualAmount) || actualAmount < 0)
    ) {
      throw new BadRequestException('确认扣费金额必须为非负整数');
    }

    const claimed = await tx.point_holds.updateMany({
      where: {
        id: holdId,
        status: { in: [PointHoldStatus.PENDING, PointHoldStatus.PROCESSING] },
      },
      data: { status: PointHoldStatus.PROCESSING },
    });
    if (claimed.count === 0) {
      const existing = await tx.point_holds.findUnique({
        where: { id: holdId },
        include: { items: true },
      });
      if (!existing) throw new BadRequestException('积分冻结不存在');
      if (
        existing.status === PointHoldStatus.CONFIRMED ||
        existing.status === PointHoldStatus.PARTIALLY_REFUNDED ||
        existing.status === PointHoldStatus.REFUNDED
      ) {
        return { confirmed: false, hold: existing };
      }
      throw new BadRequestException('当前冻结状态不能确认扣费');
    }

    const hold = await tx.point_holds.findUnique({
      where: { id: holdId },
      include: { items: true },
    });
    if (!hold) throw new BadRequestException('积分冻结不存在');
    if (hold.status !== PointHoldStatus.PROCESSING) {
      throw new BadRequestException('当前冻结状态不能确认扣费');
    }

    const confirmedAmount = actualAmount ?? hold.estimatedAmount;
    if (confirmedAmount > hold.estimatedAmount) {
      throw new BadRequestException('确认扣费不能超过冻结金额');
    }

    let remainingToConsume = confirmedAmount;
    const refundAmount = hold.estimatedAmount - confirmedAmount;
    const consumedByType = new Map<PointGrantType, number>();

    for (const item of hold.items) {
      const consumeAmount = Math.min(item.amount, remainingToConsume);
      const itemRefundAmount = item.amount - consumeAmount;
      remainingToConsume -= consumeAmount;
      if (consumeAmount > 0) {
        consumedByType.set(
          item.grantType,
          (consumedByType.get(item.grantType) ?? 0) + consumeAmount,
        );
      }

      const grantData: Prisma.point_grantsUpdateManyMutationInput = {
        frozenAmount: { decrement: item.amount },
        consumedAmount: { increment: consumeAmount },
      };
      if (itemRefundAmount > 0) {
        grantData.availableAmount = { increment: itemRefundAmount };
      }
      const updatedGrant = await tx.point_grants.updateMany({
        where: { id: item.grantId, frozenAmount: { gte: item.amount } },
        data: grantData,
      });
      if (updatedGrant.count === 0) {
        throw new BadRequestException(
          `INSUFFICIENT_FROZEN_GRANT: grant=${item.grantId} required=${item.amount}`,
        );
      }
    }

    const balanceData: Prisma.user_pointsUpdateInput = {
      frozenBalance: { decrement: hold.estimatedAmount },
      availableBalance: refundAmount > 0 ? { increment: refundAmount } : undefined,
      balance: refundAmount > 0 ? { increment: refundAmount } : undefined,
      totalBalance: { decrement: confirmedAmount },
    };
    for (const [grantType, amount] of consumedByType) {
      balanceData[GRANT_TYPE_BALANCE_FIELD[grantType]] = { decrement: amount } as never;
    }

    const balanceWhere: Prisma.user_pointsWhereInput = {
      userId: hold.userId,
      frozenBalance: { gte: hold.estimatedAmount },
    };
    for (const [grantType, amount] of consumedByType) {
      (balanceWhere as Record<string, unknown>)[GRANT_TYPE_BALANCE_FIELD[grantType]] = {
        gte: amount,
      };
    }
    const updatedPoints = await tx.user_points.updateMany({
      where: balanceWhere,
      data: balanceData,
    });
    if (updatedPoints.count === 0) {
      throw new BadRequestException('积分冻结余额不足');
    }
    const points = await tx.user_points.findUniqueOrThrow({ where: { userId: hold.userId } });

    const status =
      confirmedAmount === 0
        ? PointHoldStatus.REFUNDED
        : refundAmount > 0
          ? PointHoldStatus.PARTIALLY_REFUNDED
          : PointHoldStatus.CONFIRMED;
    const updatedHold = await tx.point_holds.update({
      where: { id: holdId },
      data: {
        status,
        confirmedAmount,
        confirmedAt: new Date(),
        refundedAt: refundAmount > 0 ? new Date() : undefined,
      },
    });

    const updatedRecord = await tx.points_records.updateMany({
      where: { holdId, status: 'PENDING' },
      data: {
        status:
          status === PointHoldStatus.REFUNDED ? 'REFUNDED' : 'CONFIRMED',
        amount: confirmedAmount,
        balance: points.balance,
        remark:
          status === PointHoldStatus.REFUNDED
            ? PointLedgerEventType.generation_refund
            : PointLedgerEventType.generation_cost,
      },
    });
    if (updatedRecord.count === 0) {
      throw new BadRequestException('积分冻结流水不存在');
    }

    return { confirmed: true, hold: updatedHold, balance: points.balance };
  }

  async refundHold(holdId: string, reason: string) {
    return this.prisma.$transaction((tx) =>
      this.refundHoldWithinTx(tx, holdId, reason),
    );
  }

  async refundHoldWithinTx(
    tx: Prisma.TransactionClient,
    holdId: string,
    reason: string,
  ) {
    const claimed = await tx.point_holds.updateMany({
      where: {
        id: holdId,
        status: { in: [PointHoldStatus.PENDING, PointHoldStatus.PROCESSING] },
      },
      data: { status: PointHoldStatus.PROCESSING },
    });
    if (claimed.count === 0) {
      const existing = await tx.point_holds.findUnique({
        where: { id: holdId },
        include: { items: true },
      });
      if (!existing) throw new BadRequestException('积分冻结不存在');
      if (existing.status === PointHoldStatus.REFUNDED) {
        return { refunded: false, amount: 0, hold: existing };
      }
      throw new BadRequestException('当前冻结状态不能退款');
    }

    const hold = await tx.point_holds.findUnique({
      where: { id: holdId },
      include: { items: true },
    });
    if (!hold) throw new BadRequestException('积分冻结不存在');
    if (hold.status !== PointHoldStatus.PROCESSING) {
      throw new BadRequestException('当前冻结状态不能退款');
    }

    const amount = hold.items.reduce((sum, item) => sum + item.amount, 0);
    for (const item of hold.items) {
      const updatedGrant = await tx.point_grants.updateMany({
        where: { id: item.grantId, frozenAmount: { gte: item.amount } },
        data: {
          frozenAmount: { decrement: item.amount },
          availableAmount: { increment: item.amount },
        },
      });
      if (updatedGrant.count === 0) {
        throw new BadRequestException(
          `INSUFFICIENT_FROZEN_GRANT: grant=${item.grantId} required=${item.amount}`,
        );
      }
    }

    const updatedPoints = await tx.user_points.updateMany({
      where: { userId: hold.userId, frozenBalance: { gte: amount } },
      data: {
        balance: { increment: amount },
        availableBalance: { increment: amount },
        frozenBalance: { decrement: amount },
      },
    });
    if (updatedPoints.count === 0) {
      throw new BadRequestException('积分冻结余额不足');
    }
    const points = await tx.user_points.findUniqueOrThrow({ where: { userId: hold.userId } });

    const updatedHold = await tx.point_holds.update({
      where: { id: holdId },
      data: {
        status: PointHoldStatus.REFUNDED,
        confirmedAmount: 0,
        refundedAt: new Date(),
      },
    });
    const updatedRecord = await tx.points_records.updateMany({
      where: { holdId, status: 'PENDING' },
      data: {
        status: 'REFUNDED',
        balance: points.balance,
        remark: `refund: ${reason}`,
      },
    });
    if (updatedRecord.count === 0) {
      throw new BadRequestException('积分冻结流水不存在');
    }

    return { refunded: true, amount, hold: updatedHold, balance: points.balance };
  }

  async expireGrants(now = new Date()) {
    return this.prisma.$transaction(async (tx) => {
      const grants = await tx.point_grants.findMany({
        where: { expiresAt: { lte: now }, availableAmount: { gt: 0 } },
      });
      let expiredAmount = 0;
      for (const grant of grants) {
        expiredAmount += grant.availableAmount;
        const points = await tx.user_points.update({
          where: { userId: grant.userId },
          data: {
            balance: { decrement: grant.availableAmount },
            availableBalance: { decrement: grant.availableAmount },
            totalBalance: { decrement: grant.availableAmount },
            [GRANT_TYPE_BALANCE_FIELD[grant.grantType]]: {
              decrement: grant.availableAmount,
            },
          },
        });
        await tx.point_grants.update({
          where: { id: grant.id },
          data: {
            expiredAmount: { increment: grant.availableAmount },
            availableAmount: 0,
          },
        });
        await tx.points_records.create({
          data: {
            userId: grant.userId,
            type: 'CONSUME',
            amount: grant.availableAmount,
            source: PointsSource.EXPIRATION,
            sourceId: grant.id,
            balance: points.balance,
            remark: PointLedgerEventType.expiration,
          },
        });
      }
      return { expiredGrants: grants.length, expiredAmount };
    });
  }

  async deductPoints(
    userId: string,
    amount: number,
    source: PointsSource,
    sourceId?: string,
    remark?: string,
  ): Promise<number> {
    return this.prisma.$transaction((tx) =>
      this.deductWithinTx(tx, userId, amount, source, sourceId, remark),
    );
  }

  /**
   * 原子扣减（必须在调用方的事务内执行，以便与其它写操作同生共死）。
   * 统一扣减最新 grant 账本，并用条件 update 防止 grant / 总余额在并发下超扣。
   * 受影响行数为 0 即余额不足或账本不一致。
   */
  async deductWithinTx(
    tx: Prisma.TransactionClient,
    userId: string,
    amount: number,
    source: PointsSource,
    sourceId?: string,
    remark?: string,
    taskType?: string,
  ): Promise<number> {
    this.assertPositiveAmount(amount);

    const grants = await tx.point_grants.findMany({
      where: {
        userId,
        availableAmount: { gt: 0 },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }],
    });
    const eligibilityTaskType = taskType ?? remark ?? String(source);
    const usableGrants = grants.filter((grant) =>
      this.grantCanBeUsedForTask(grant, eligibilityTaskType),
    );
    const selected = this.selectGrantsForAmount(usableGrants, amount);
    const consumedByType = new Map<PointGrantType, number>();

    for (const item of selected) {
      const updatedGrant = await tx.point_grants.updateMany({
        where: { id: item.grant.id, availableAmount: { gte: item.amount } },
        data: {
          availableAmount: { decrement: item.amount },
          consumedAmount: { increment: item.amount },
        },
      });
      if (updatedGrant.count === 0) {
        throw new BadRequestException(
          `INSUFFICIENT_GRANT: grant=${item.grant.id} required=${item.amount}`,
        );
      }
      consumedByType.set(
        item.grant.grantType,
        (consumedByType.get(item.grant.grantType) ?? 0) + item.amount,
      );
    }

    const balanceWhere: Prisma.user_pointsWhereInput = {
      userId,
      balance: { gte: amount },
      availableBalance: { gte: amount },
    };
    const balanceData: Prisma.user_pointsUpdateInput = {
      balance: { decrement: amount },
      availableBalance: { decrement: amount },
      totalBalance: { decrement: amount },
    };
    for (const [grantType, consumedAmount] of consumedByType) {
      (balanceWhere as Record<string, unknown>)[GRANT_TYPE_BALANCE_FIELD[grantType]] = {
        gte: consumedAmount,
      };
      balanceData[GRANT_TYPE_BALANCE_FIELD[grantType]] = {
        decrement: consumedAmount,
      } as never;
    }

    const res = await tx.user_points.updateMany({
      where: balanceWhere,
      data: balanceData,
    });
    if (res.count === 0) {
      throw new BadRequestException('积分余额不足');
    }

    const points = await tx.user_points.findUniqueOrThrow({ where: { userId } });

    await tx.points_records.create({
      data: {
        userId,
        type: 'CONSUME',
        amount,
        source,
        sourceId,
        balance: points.balance,
        remark,
      },
    });

    return points.balance;
  }

  private assertPositiveAmount(amount: number) {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException('积分数量必须为正整数');
    }
  }

  private eventToLegacySource(event: PointLedgerEventType): PointsSource {
    switch (event) {
      case PointLedgerEventType.subscription_grant:
        return PointsSource.MEMBERSHIP;
      case PointLedgerEventType.points_purchase:
        return PointsSource.PACKAGE;
      case PointLedgerEventType.campaign_bonus:
        return PointsSource.CAMPAIGN;
      case PointLedgerEventType.expiration:
        return PointsSource.EXPIRATION;
      default:
        return PointsSource.ADMIN_GRANT;
    }
  }

  private selectGrantsForAmount(grants: PointGrantRecord[], amount: number) {
    const ordered = [...grants].sort((a, b) => {
      const aTime = a.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bTime = b.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      if (aTime !== bTime) return aTime - bTime;
      return GRANT_TYPE_PRIORITY[a.grantType] - GRANT_TYPE_PRIORITY[b.grantType];
    });

    let remaining = amount;
    const selected: Array<{ grant: PointGrantRecord; amount: number }> = [];
    for (const grant of ordered) {
      if (remaining <= 0) break;
      const use = Math.min(grant.availableAmount, remaining);
      if (use > 0) {
        selected.push({ grant, amount: use });
        remaining -= use;
      }
    }
    if (remaining > 0) {
      throw new BadRequestException('积分余额不足');
    }
    return selected;
  }

  private pricingRuleMatches(rule: any, input: EstimateCostInput) {
    if (rule.modelProvider && rule.modelProvider !== input.modelProvider) return false;
    if (rule.modelName && rule.modelName !== input.modelName) return false;
    if (rule.quality && rule.quality !== input.quality) return false;
    if (rule.resolution && rule.resolution !== input.resolution) return false;
    if (rule.modelTier && rule.modelTier !== input.modelTier) return false;
    if (rule.minDurationSeconds != null && (input.seconds ?? 0) < rule.minDurationSeconds) {
      return false;
    }
    if (rule.maxDurationSeconds != null && (input.seconds ?? 0) > rule.maxDurationSeconds) {
      return false;
    }
    // P1-2: 仅当调用方显式传入 membershipLevel/grantType 时才强制校验，
    // 避免破坏既有"无上下文估价"调用。
    if (input.membershipLevel != null) {
      const allowedLevels = this.numberArray(rule.allowedMembershipLevels);
      if (allowedLevels.length > 0 && !allowedLevels.includes(input.membershipLevel)) {
        return false;
      }
    }
    if (input.grantType != null) {
      const disallowedGrants = this.stringArray(rule.disallowedGrantTypes);
      if (disallowedGrants.includes(input.grantType)) return false;
    }
    return true;
  }

  private numberArray(value: unknown): number[] {
    if (!Array.isArray(value)) return [];
    return value.filter((v): v is number => typeof v === 'number');
  }

  private tokenCost(tokens: number | undefined, costPerK: Prisma.Decimal | null) {
    if (!tokens || !costPerK) return 0;
    return (tokens / 1000) * Number(costPerK);
  }

  private grantCanBeUsedForTask(grant: PointGrantRecord, taskType: string) {
    const scope = this.normalizeUsageScope(grant.usageScope);
    if (!scope) return true;

    const allowed = this.stringArray(scope.allowedTaskTypes);
    if (allowed.length > 0 && !allowed.includes(taskType)) return false;

    const excluded = this.stringArray(scope.excludedTaskTypes);
    if (excluded.includes(taskType)) return false;

    const allowedPrefixes = this.stringArray(scope.allowedTaskPrefixes);
    if (
      allowedPrefixes.length > 0 &&
      !allowedPrefixes.some((prefix) => taskType.startsWith(prefix))
    ) {
      return false;
    }

    const excludedPrefixes = this.stringArray(scope.excludedTaskPrefixes);
    if (excludedPrefixes.some((prefix) => taskType.startsWith(prefix))) return false;

    return true;
  }

  private normalizeUsageScope(value: Prisma.JsonValue | null | undefined) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  }

  private stringArray(value: unknown) {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  }
}
