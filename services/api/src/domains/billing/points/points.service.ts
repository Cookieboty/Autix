import { Injectable } from '@nestjs/common';
import { PointsLedgerService, type GrantPointsInput } from './services/points-ledger.service';
import { PointsHoldService } from './services/points-hold.service';
import {
  TaskPricingEstimatorService,
  type TaskEstimateInput,
} from './services/task-pricing-estimator.service';
import { PointsRepository } from './repositories/points.repository';
import { PointsSource, Prisma } from '../../platform/prisma/generated';

export type { TaskEstimateInput, TaskEstimateResult } from './services/task-pricing-estimator.service';
export { HoldConcurrencyLimitExceededError } from './services/points-hold.helpers';

@Injectable()
export class PointsService {
  constructor(
    private readonly pointsRepo: PointsRepository,
    private readonly ledgerService: PointsLedgerService,
    private readonly holdService: PointsHoldService,
    private readonly taskPricingService: TaskPricingEstimatorService,
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
    return this.pointsRepo.findActivePackages();
  }

  async estimateCost(input: TaskEstimateInput) {
    return this.taskPricingService.estimateCost(input);
  }

  async getPackageById(id: string) {
    return this.pointsRepo.findPackageById(id);
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

  async countActiveHoldsByType(userId: string, taskType: string): Promise<number> {
    return this.holdService.countActiveHoldsByType(userId, taskType);
  }

  async findPendingHoldByTask(input: { taskType?: string; taskId: string }) {
    return this.holdService.findPendingHoldByTask(input);
  }

  async confirmHold(holdId: string, actualAmount?: number) {
    return this.holdService.confirmHold(holdId, actualAmount);
  }

  async quoteHoldFromSnapshot(
    holdId: string,
    usage: Record<string, unknown>,
    tx?: Prisma.TransactionClient,
  ) {
    return this.holdService.quoteHoldFromSnapshot(holdId, usage, tx);
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
