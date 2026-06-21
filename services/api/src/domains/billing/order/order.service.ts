import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { OrderRepository } from './repositories/order.repository';
import { PaymentEventRepository } from './repositories/payment-event.repository';
import { OrderCreationService } from './services/order-creation.service';
import { OrderFulfillmentService } from './services/order-fulfillment.service';
import { OrderRefundService } from './services/order-refund.service';
import {
  OrderStatus,
  OrderType,
  Prisma,
  type orders,
} from '../../platform/prisma/generated';
import { addMonths } from '../../platform/common/date-utils';
import {
  DEFAULT_PAYMENT_CURRENCY,
  toJsonInput,
  type PaymentDetails,
  type PaymentWebhookInput,
} from './services/order-fulfillment.helpers';
import type { RefundOrderInput } from './services/order-refund.helpers';

@Injectable()
export class OrderService {
  static addMonths(from: Date, months: number): Date {
    return addMonths(from, months);
  }

  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly creationService: OrderCreationService,
    private readonly fulfillmentService: OrderFulfillmentService,
    private readonly refundService: OrderRefundService,
    private readonly paymentEventRepo: PaymentEventRepository,
  ) {}

  async recoverStaleProcessingEvents(): Promise<number> {
    return this.paymentEventRepo.recoverStaleProcessingEvents();
  }

  async createOrder(
    userId: string,
    data: {
      orderType: OrderType;
      businessType?: import('../../platform/prisma/generated').OrderBusinessType;
      productId: string;
      productName: string;
      originalPrice: Prisma.Decimal;
      amount: Prisma.Decimal;
      isFirstTime: boolean;
      currency?: string;
    },
  ) {
    return this.creationService.createOrder(userId, data);
  }

  async createMembershipOrder(userId: string, planId: string, currency = DEFAULT_PAYMENT_CURRENCY) {
    return this.creationService.createMembershipOrder(userId, planId, currency);
  }

  async createPointsPackageOrder(
    userId: string,
    packageId: string,
    currency = DEFAULT_PAYMENT_CURRENCY,
  ) {
    return this.creationService.createPointsPackageOrder(userId, packageId, currency);
  }

  async assertOrderCanCheckout(order: orders) {
    return this.creationService.assertOrderCanCheckout(order);
  }

  async attachStripeCheckoutSession(
    orderId: string,
    input: {
      sessionId: string;
      currency: string;
      metadata?: unknown;
    },
  ) {
    const order = await this.orderRepo.findByIdOrThrow(orderId);
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('只有待支付订单可以创建支付会话');
    }

    return this.orderRepo.update(orderId, {
      paymentProvider: 'stripe',
      externalPaymentId: input.sessionId,
      currency: input.currency,
      paymentMetadata: toJsonInput(input.metadata),
    });
  }

  async getUserOrders(
    userId: string,
    query: { page?: number; pageSize?: number; status?: string; orderType?: OrderType },
  ) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 50);
    const skip = (page - 1) * pageSize;

    const where: Prisma.ordersWhereInput = { userId };
    if (query.status) where.status = query.status as OrderStatus;
    if (query.orderType) where.orderType = query.orderType;

    const [items, total] = await Promise.all([
      this.orderRepo.findMany(where, { skip, take: pageSize }),
      this.orderRepo.count(where),
    ]);

    return { items, total, page, pageSize, hasMore: skip + items.length < total };
  }

  async getOrderById(id: string, userId: string) {
    const order = await this.orderRepo.findById(id);
    if (!order) throw new NotFoundException('订单不存在');
    if (order.userId !== userId) throw new ForbiddenException('无权访问此订单');
    return order;
  }

  async getOrderForAdmin(id: string) {
    return this.orderRepo.findByIdOrThrow(id);
  }

  async cancelOrder(id: string, userId: string) {
    const order = await this.getOrderById(id, userId);
    if (order.status !== 'PENDING') {
      throw new BadRequestException('只能取消待付款的订单');
    }

    return this.orderRepo.updateStatus(id, OrderStatus.CANCELLED);
  }

  async markPaidAndFulfill(id: string) {
    return this.fulfillmentService.markPaidAndFulfill(id);
  }

  async markPaidAndFulfillWithPayment(id: string, payment?: PaymentDetails) {
    return this.fulfillmentService.markPaidAndFulfillWithPayment(id, payment);
  }

  async confirmManualPayment(
    id: string,
    input: PaymentDetails & { operatorId?: string; remark?: string } = {},
  ) {
    return this.fulfillmentService.confirmManualPayment(id, input);
  }

  async handlePaymentWebhook(input: PaymentWebhookInput) {
    return this.fulfillmentService.handlePaymentWebhook(input);
  }

  async refundOrder(id: string, input: RefundOrderInput = {}) {
    return this.refundService.refundOrder(id, input);
  }
}
