import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import type { ErrorCode } from '@autix/domain';
import { I18nHttpException } from '../../../platform/i18n/i18n-http.exception';
import { quoteTaskFromSnapshot } from '@autix/domain/pricing';
import { PointsRepository } from '../repositories/points.repository';
import { PointsLedgerService } from './points-ledger.service';
import {
  PointHoldStatus,
  Prisma,
} from '../../../platform/prisma/generated';
import {
  assertConfirmAmount,
  buildConfirmHoldUpdateData,
  buildConfirmRecordUpdateData,
  buildHoldConfirmationPlan,
  buildHoldCreateData,
  buildHoldItemCreateData,
  buildPendingHoldRecordData,
  buildRefundHoldUpdateData,
  buildRefundRecordUpdateData,
  isConfirmTerminalStatus,
  isRefundTerminalStatus,
  parsePricingSnapshot,
  presentConfirmedHoldStatus,
  sumHoldItemAmount,
  type CreateHoldInput,
} from './points-hold.helpers';

interface FindHoldByTaskInput {
  taskType?: string;
  taskId: string;
}

/** FIX-10: 孤儿 hold 的默认超时（60 分钟）；超过仍未结算即视为孤儿并退款释放冻结。 */
const ORPHANED_HOLD_TIMEOUT_MS = 60 * 60 * 1000;

@Injectable()
export class PointsHoldService {
  private readonly logger = new Logger(PointsHoldService.name);

  constructor(
    private readonly pointsRepo: PointsRepository,
    private readonly ledgerService: PointsLedgerService,
  ) { }

  /**
   * FIX-10: 回收孤儿 hold——任务崩溃/未落库导致 hold 长期 PENDING/PROCESSING，
   * 会永久冻结用户积分。扫描超时的 hold 并 refundHold 释放（refundHold 内部用
   * claimHoldForProcessing 幂等，已终态的 hold 会被跳过）。
   */
  async reclaimOrphanedHolds(
    options: { olderThanMs?: number; now?: Date } = {},
  ): Promise<{ scanned: number; reclaimed: number }> {
    const olderThanMs = options.olderThanMs ?? ORPHANED_HOLD_TIMEOUT_MS;
    const cutoff = new Date((options.now ?? new Date()).getTime() - olderThanMs);
    const stale = await this.pointsRepo.findStaleHolds(cutoff);
    let reclaimed = 0;
    for (const hold of stale) {
      try {
        await this.refundHold(hold.id, 'orphaned hold auto-reclaim');
        reclaimed += 1;
      } catch (err) {
        this.logger.warn(
          `orphaned hold reclaim failed: hold=${hold.id} reason=${(err as Error).message}`,
        );
      }
    }
    if (reclaimed > 0) {
      this.logger.log(`orphaned holds reclaimed: ${reclaimed}/${stale.length}`);
    }
    return { scanned: stale.length, reclaimed };
  }

  async countActiveHoldsByType(userId: string, taskType: string): Promise<number> {
    return this.pointsRepo.countActiveHoldsByType(userId, taskType);
  }

  async createHold(userId: string, input: CreateHoldInput) {
    this.ledgerService.assertPositiveAmount(input.amount);

    return this.pointsRepo.runInTransaction(async (tx) => {
      // FIX-9b: 同一任务已有活跃 hold 时直接返回，幂等去重（防重试/并发重复冻结）。
      if (input.taskId) {
        const existing = await this.pointsRepo.findPendingHoldByTaskWithinTx(tx, {
          taskType: input.taskType,
          taskId: input.taskId,
        });
        if (existing) {
          const points = await this.pointsRepo.findBalanceWithinTx(tx, userId);
          return { hold: existing, balance: points.balance };
        }
      }

      const grants = await this.pointsRepo.findAvailableGrantsWithinTx(tx, userId);
      const usableGrants = grants.filter((grant) =>
        this.ledgerService.grantCanBeUsedForTask(grant, input.taskType),
      );
      const selected = this.ledgerService.selectGrantsForAmount(usableGrants, input.amount);

      const hold = await this.pointsRepo.createHoldWithinTx(
        tx,
        buildHoldCreateData(userId, input),
      );

      for (const item of selected) {
        const updated = await this.pointsRepo.freezeGrantForHoldWithinTx(tx, {
          grantId: item.grant.id,
          amount: item.amount,
        });
        if (updated === 0) {
          throw new I18nHttpException(
            HttpStatus.BAD_REQUEST,
            'points.hold_grant_insufficient',
            { grantId: item.grant.id, required: item.amount },
            { code: 'INSUFFICIENT_GRANT' as ErrorCode },
          );
        }
        await this.pointsRepo.createHoldItemWithinTx(
          tx,
          buildHoldItemCreateData(hold.id, item),
        );
      }

      const updatedPoints = await this.pointsRepo.moveBalanceToFrozenWithinTx(
        tx,
        userId,
        input.amount,
      );
      if (updatedPoints === 0) {
        throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'points.balance_insufficient');
      }
      const points = await this.pointsRepo.findBalanceWithinTx(tx, userId);

      await this.pointsRepo.createRecordWithinTx(
        tx,
        buildPendingHoldRecordData({
          userId,
          holdId: hold.id,
          createInput: input,
          balance: points.balance,
        }),
      );

      return { hold, balance: points.balance };
    });
  }

  async findPendingHoldByTask(input: FindHoldByTaskInput) {
    return this.pointsRepo.findPendingHoldByTask(input);
  }

  async confirmHold(holdId: string, actualAmount?: number) {
    return this.pointsRepo.runInTransaction((tx) =>
      this.confirmHoldWithinTx(tx, holdId, actualAmount),
    );
  }

  async confirmHoldWithinTx(
    tx: Prisma.TransactionClient,
    holdId: string,
    actualAmount?: number,
  ) {
    assertConfirmAmount(actualAmount);

    const claimed = await this.pointsRepo.claimHoldForProcessingWithinTx(tx, holdId);
    if (claimed === 0) {
      const existing = await this.pointsRepo.findHoldWithItemsWithinTx(tx, holdId);
      if (!existing) throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'points.hold_not_found');
      if (isConfirmTerminalStatus(existing.status)) {
        return { confirmed: false, hold: existing };
      }
      throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'points.hold_status_invalid_for_capture');
    }

    const hold = await this.pointsRepo.findHoldWithItemsWithinTx(tx, holdId);
    if (!hold) throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'points.hold_not_found');
    if (hold.status !== PointHoldStatus.PROCESSING) {
      throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'points.hold_status_invalid_for_capture');
    }

    const confirmation = buildHoldConfirmationPlan({
      estimatedAmount: hold.estimatedAmount,
      items: hold.items,
      actualAmount,
    });

    for (const itemConsumption of confirmation.itemConsumptions) {
      const updatedGrant = await this.pointsRepo.confirmHeldGrantItemWithinTx(
        tx,
        itemConsumption.item,
        itemConsumption.consumeAmount,
        itemConsumption.refundAmount,
      );
      if (updatedGrant === 0) {
        throw new I18nHttpException(
          HttpStatus.BAD_REQUEST,
          'points.hold_amount_invalid',
          { grantId: itemConsumption.item.grantId, required: itemConsumption.item.amount },
          { code: 'INSUFFICIENT_FROZEN_GRANT' as ErrorCode },
        );
      }
    }

    const updatedPoints = await this.pointsRepo.confirmHeldBalanceWithinTx(tx, {
      userId: hold.userId,
      estimatedAmount: hold.estimatedAmount,
      confirmedAmount: confirmation.confirmedAmount,
      refundAmount: confirmation.refundAmount,
      consumedByType: confirmation.consumedByType,
    });
    if (updatedPoints === 0) {
      throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'points.hold_balance_insufficient');
    }
    const points = await this.pointsRepo.findBalanceWithinTx(tx, hold.userId);

    const status = presentConfirmedHoldStatus(
      confirmation.confirmedAmount,
      confirmation.refundAmount,
    );
    const updatedHold = await this.pointsRepo.updateHoldWithinTx(
      tx,
      holdId,
      buildConfirmHoldUpdateData(
        status,
        confirmation.confirmedAmount,
        confirmation.refundAmount,
      ),
    );

    const updatedRecord = await this.pointsRepo.updatePendingHoldRecordWithinTx(
      tx,
      holdId,
      buildConfirmRecordUpdateData({
        status,
        confirmedAmount: confirmation.confirmedAmount,
        balance: points.balance,
      }),
    );
    if (updatedRecord === 0) {
      throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'points.hold_not_found');
    }

    return { confirmed: true, hold: updatedHold, balance: points.balance };
  }

  async refundHold(holdId: string, reason: string) {
    return this.pointsRepo.runInTransaction((tx) =>
      this.refundHoldWithinTx(tx, holdId, reason),
    );
  }

  async refundHoldWithinTx(
    tx: Prisma.TransactionClient,
    holdId: string,
    reason: string,
  ) {
    const claimed = await this.pointsRepo.claimHoldForProcessingWithinTx(tx, holdId);
    if (claimed === 0) {
      const existing = await this.pointsRepo.findHoldWithItemsWithinTx(tx, holdId);
      if (!existing) throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'points.hold_not_found');
      if (isRefundTerminalStatus(existing.status)) {
        return { refunded: false, amount: 0, hold: existing };
      }
      throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'points.hold_status_invalid_for_refund');
    }

    const hold = await this.pointsRepo.findHoldWithItemsWithinTx(tx, holdId);
    if (!hold) throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'points.hold_not_found');
    if (hold.status !== PointHoldStatus.PROCESSING) {
      throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'points.hold_status_invalid_for_refund');
    }

    const amount = sumHoldItemAmount(hold.items);
    for (const item of hold.items) {
      const updatedGrant = await this.pointsRepo.refundHeldGrantItemWithinTx(tx, item);
      if (updatedGrant === 0) {
        throw new I18nHttpException(
          HttpStatus.BAD_REQUEST,
          'points.hold_amount_invalid',
          { grantId: item.grantId, required: item.amount },
          { code: 'INSUFFICIENT_FROZEN_GRANT' as ErrorCode },
        );
      }
    }

    const updatedPoints = await this.pointsRepo.refundHeldBalanceWithinTx(
      tx,
      hold.userId,
      amount,
    );
    if (updatedPoints === 0) {
      throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'points.hold_balance_insufficient');
    }
    const points = await this.pointsRepo.findBalanceWithinTx(tx, hold.userId);

    const updatedHold = await this.pointsRepo.updateHoldWithinTx(
      tx,
      holdId,
      buildRefundHoldUpdateData(),
    );
    const updatedRecord = await this.pointsRepo.updatePendingHoldRecordWithinTx(
      tx,
      holdId,
      buildRefundRecordUpdateData({ balance: points.balance, reason }),
    );
    if (updatedRecord === 0) {
      throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'points.hold_not_found');
    }

    return { refunded: true, amount, hold: updatedHold, balance: points.balance };
  }

  /**
   * Settlement-time pricing entry point. Prices strictly from the hold's frozen
   * pricingSnapshot (never the live DB — an admin editing model_configs after a hold
   * is created must never re-price a task already in flight) and caps the result at
   * the frozen estimatedAmount.
   *
   * The cap is mandatory, not defensive: buildHoldConfirmationPlan() throws
   * BadRequestException('确认扣费不能超过冻结金额') when confirmedAmount >
   * estimatedAmount, and phase 2 does not change that chain. An over-estimate (e.g.
   * chat outputTokens running longer than token-estimation.ts predicted) must be
   * clamped here, before it ever reaches confirmHold(). The warn on clamp is the
   * point — the old code capped silently, so nobody ever learned how badly
   * token-estimation.ts was off.
   *
   * Deliberately not a top-up flow: freezing more of a user's balance *after*
   * their content has already been generated is a product decision (refuse to
   * deliver finished work vs. allow a negative balance) nobody has made. Capping
   * loses a little revenue instead.
   */
  async quoteHoldFromSnapshot(
    holdId: string,
    usage: Record<string, unknown>,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const hold = tx
      ? await this.pointsRepo.findHoldByIdWithinTx(tx, holdId)
      : await this.pointsRepo.findHoldById(holdId);
    if (!hold) throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'points.hold_not_found');

    // Missing or unparseable snapshot must throw here, never fall back to
    // re-estimating from the live DB — that fallback is exactly the disease this
    // refactor exists to cure (call-billing.service.ts used to swallow a
    // BadRequestException from the estimator and silently charge by a different
    // formula).
    const snapshot = parsePricingSnapshot(hold.pricingSnapshot);
    const { total: raw } = quoteTaskFromSnapshot(snapshot, usage);
    const capped = Math.min(raw, hold.estimatedAmount);

    if (raw > hold.estimatedAmount) {
      this.logger.warn(
        `quoteHoldFromSnapshot: hold=${holdId} raw=${raw} exceeds frozen estimatedAmount=${hold.estimatedAmount}; capping to ${hold.estimatedAmount}. usage=${JSON.stringify(usage)}`,
      );
    }

    return capped;
  }
}
