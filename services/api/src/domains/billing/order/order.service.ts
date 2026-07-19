import { Injectable, HttpStatus } from '@nestjs/common';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';
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
  ) { }

  async recoverStaleProcessingEvents(): Promise<number> {
    return this.paymentEventRepo.recoverStaleProcessingEvents();
  }

  async cancelExpiredPendingOrders(now = new Date()): Promise<number> {
    return this.creationService.cancelExpiredPendingOrders(now);
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
    await this.cancelExpiredPendingOrders();
    return this.creationService.createMembershipOrder(userId, planId, currency);
  }

  async createPointsPackageOrder(
    userId: string,
    packageId: string,
    currency = DEFAULT_PAYMENT_CURRENCY,
  ) {
    await this.cancelExpiredPendingOrders();
    return this.creationService.createPointsPackageOrder(userId, packageId, currency);
  }

  async assertOrderCanCheckout(order: orders) {
    return this.creationService.assertOrderCanCheckout(order);
  }

  async getMembershipPlanForOrder(order: Pick<orders, 'orderType' | 'productId'>) {
    if (order.orderType !== OrderType.MEMBERSHIP) return null;
    return this.orderRepo.findMembershipPlan(order.productId);
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
    const resolvedOrder = await this.resolveExpiredPendingOrder(order);
    if (resolvedOrder.status !== OrderStatus.PENDING) {
      throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'order.timeout_cancelled');
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
    await this.cancelExpiredPendingOrders();
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
    if (!order) throw new I18nHttpException(HttpStatus.NOT_FOUND, 'order.not_found');
    if (order.userId !== userId) throw new I18nHttpException(HttpStatus.FORBIDDEN, 'order.forbidden');
    return this.resolveExpiredPendingOrder(order);
  }

  async getOrderForAdmin(id: string) {
    const order = await this.orderRepo.findByIdOrThrow(id);
    return this.resolveExpiredPendingOrder(order);
  }

  async cancelOrder(id: string, userId: string) {
    const order = await this.getOrderById(id, userId);
    if (order.status !== 'PENDING') {
      throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'order.only_pending_can_cancel');
    }

    return this.orderRepo.updateStatus(id, OrderStatus.CANCELLED);
  }

  async resolveExpiredPendingOrder(order: orders, now = new Date()) {
    if (!this.creationService.isPendingOrderExpired(order, now)) return order;
    return this.orderRepo.cancelExpiredPendingOrder(
      order.id,
      this.creationService.pendingOrderExpiresBefore(now),
    );
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

  async syncStripeSubscription(input: {
    subscriptionId: string;
    customerId?: string;
    status?: string;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
    cancelAtPeriodEnd?: boolean;
    cancelledAt?: Date;
    eventType?: string;
    eventId?: string;
    payload?: unknown;
  }) {
    return this.orderRepo.syncUserMembershipByStripeSubscriptionId(input);
  }

  async refundOrder(id: string, input: RefundOrderInput = {}) {
    return this.refundService.refundOrder(id, input);
  }
}
