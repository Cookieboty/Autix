import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { PointsLedgerService, type GrantPointsInput } from './services/points-ledger.service';
import { PointsHoldService } from './services/points-hold.service';
import { PricingEstimatorService, type EstimateCostInput } from './services/pricing-estimator.service';
import { PointsSource, Prisma } from '../../platform/prisma/generated';

export type { EstimateCostInput } from './services/pricing-estimator.service';

@Injectable()
export class PointsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: PointsLedgerService,
    private readonly holdService: PointsHoldService,
    private readonly pricingService: PricingEstimatorService,
  ) {}

  async getBalance(userId: string) {
    return this.ledgerService.getBalance(userId);
  }

  async getAccountSummary(userId: string) {
    return this.ledgerService.getAccountSummary(userId);
  }

  async getRecords(
    userId: string,
    query: { page?: number; pageSize?: number; source?: PointsSource },
  ) {
    return this.ledgerService.getRecords(userId, query);
  }

  async getPackages() {
    return this.prisma.points_packages.findMany({
      where: { isActive: true },
      orderBy: { sort: 'asc' },
    });
  }

  async getTaskCosts() {
    return this.pricingService.getTaskCosts();
  }

  async getPricingRules() {
    return this.pricingService.getPricingRules();
  }

  async estimateCost(input: EstimateCostInput) {
    return this.pricingService.estimateCost(input);
  }

  async previewPricingRule(input: EstimateCostInput) {
    return this.pricingService.previewPricingRule(input);
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
    return this.ledgerService.addPoints(userId, amount, source, sourceId, remark);
  }

  async grantPoints(userId: string, input: GrantPointsInput) {
    return this.ledgerService.grantPoints(userId, input);
  }

  async grantPointsWithinTx(
    tx: Prisma.TransactionClient,
    userId: string,
    input: GrantPointsInput,
  ) {
    return this.ledgerService.grantPointsWithinTx(tx, userId, input);
  }

  async createHold(userId: string, input: {
    taskType: string;
    taskId?: string;
    source?: PointsSource;
    amount: number;
    pricingSnapshot?: Prisma.InputJsonValue;
    refundPolicySnapshot?: Prisma.InputJsonValue;
    metadata?: Prisma.InputJsonValue;
    remark?: string;
  }) {
    return this.holdService.createHold(userId, input);
  }

  async findPendingHoldByTask(input: { taskType?: string; taskId: string }) {
    return this.holdService.findPendingHoldByTask(input);
  }

  async confirmHold(holdId: string, actualAmount?: number) {
    return this.holdService.confirmHold(holdId, actualAmount);
  }

  async confirmHoldWithinTx(
    tx: Prisma.TransactionClient,
    holdId: string,
    actualAmount?: number,
  ) {
    return this.holdService.confirmHoldWithinTx(tx, holdId, actualAmount);
  }

  async refundHold(holdId: string, reason: string) {
    return this.holdService.refundHold(holdId, reason);
  }

  async refundHoldWithinTx(
    tx: Prisma.TransactionClient,
    holdId: string,
    reason: string,
  ) {
    return this.holdService.refundHoldWithinTx(tx, holdId, reason);
  }

  async expireGrants(now = new Date()) {
    return this.ledgerService.expireGrants(now);
  }

  async deductPoints(
    userId: string,
    amount: number,
    source: PointsSource,
    sourceId?: string,
    remark?: string,
  ): Promise<number> {
    return this.ledgerService.deductPoints(userId, amount, source, sourceId, remark);
  }

  async deductWithinTx(
    tx: Prisma.TransactionClient,
    userId: string,
    amount: number,
    source: PointsSource,
    sourceId?: string,
    remark?: string,
    taskType?: string,
  ): Promise<number> {
    return this.ledgerService.deductWithinTx(tx, userId, amount, source, sourceId, remark, taskType);
  }
}
