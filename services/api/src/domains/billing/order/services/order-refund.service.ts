import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { OrderRepository } from '../repositories/order.repository';
import { PaymentEventRepository } from '../repositories/payment-event.repository';
import { OrderPointReclaimService } from './order-point-reclaim.service';
import { OrderStatus } from '../../../platform/prisma/generated';
import {
  assertRefundAmountWithinPaidAmount,
  buildAlreadyRefundedResult,
  buildMembershipRevocationForRefund,
  buildRefundOrderUpdate,
  buildRefundPaymentEventInput,
  extractOrderSubscriptionId,
  type RefundOrderInput,
} from './order-refund.helpers';

@Injectable()
export class OrderRefundService {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly paymentEventRepo: PaymentEventRepository,
    private readonly pointReclaimService: OrderPointReclaimService,
  ) {}

  async refundOrder(id: string, input: RefundOrderInput = {}) {
    return this.orderRepo.runInTransaction(async (tx) => {
      // FIX-16: 在事务内对订单行加锁（FOR UPDATE），串行化并发退款，
      // 第二个并发退款会在第一个提交后看到 REFUNDED 状态而幂等返回。
      const order = await this.orderRepo.lockWithinTx(tx, id);
      if (order.status === OrderStatus.REFUNDED) {
        return buildAlreadyRefundedResult(order);
      }
      if (order.status !== OrderStatus.PAID) {
        throw new BadRequestException('Only paid orders can be refunded');
      }

      // FIX-7/9: 退款金额不得超过已支付金额。
      assertRefundAmountWithinPaidAmount(order, input);

      const pointRecovery = await this.pointReclaimService.reclaimAvailableOrderPointsWithinTx(
        tx,
        order,
        input.reason ?? 'order refund',
        {
          reclaimPoints: input.reclaimPoints,
          maxPointsToReclaim: input.maxPointsToReclaim,
        },
      );

      await this.orderRepo.clearPendingMembershipChangeForOrderWithinTx(tx, order);

      // FIX-1: 退款撤销与该订单关联的会员权益（任何退款都撤销）。
      const membership = await this.orderRepo.findUserMembershipWithLevelWithinTx(tx, order.userId);
      const revocation = buildMembershipRevocationForRefund(order, membership, {
        orderSubscriptionId: extractOrderSubscriptionId(order.paymentMetadata),
      });
      let membershipRevoked = false;
      let cancelSubscriptionId: string | undefined;
      if (revocation) {
        await this.orderRepo.updateUserMembershipByUserIdWithinTx(tx, order.userId, revocation);
        membershipRevoked = true;
        cancelSubscriptionId = membership?.stripeSubscriptionId ?? undefined;
      }

      await this.paymentEventRepo.upsertRefundEventWithinTx(
        tx,
        buildRefundPaymentEventInput(order, input),
      );

      const refundedOrder = await this.orderRepo.updateWithinTx(tx, id, {
        ...buildRefundOrderUpdate(order, pointRecovery, input),
      });

      return {
        order: refundedOrder,
        alreadyRefunded: false,
        membershipRevoked,
        cancelSubscriptionId,
        ...pointRecovery,
      };
    });
  }
}
