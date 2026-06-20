import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { OrderRepository } from '../repositories/order.repository';
import { PaymentEventRepository } from '../repositories/payment-event.repository';
import { OrderPointReclaimService } from './order-point-reclaim.service';
import { OrderStatus } from '../../../platform/prisma/generated';
import {
  buildAlreadyRefundedResult,
  buildRefundOrderUpdate,
  buildRefundPaymentEventInput,
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
      const order = await this.orderRepo.findByIdWithinTxOrThrow(tx, id);
      if (order.status === OrderStatus.REFUNDED) {
        return buildAlreadyRefundedResult(order);
      }
      if (order.status !== OrderStatus.PAID) {
        throw new BadRequestException('只有已支付订单可以退款');
      }

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
        ...pointRecovery,
      };
    });
  }
}
