import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma/prisma.service';
import {
  OrderStatus,
  OrderType,
  PointLedgerEventType,
  Prisma,
  type membership_plans,
  type orders,
  type point_grants,
  type points_packages,
  type points_records,
  type user_memberships,
  type user_points,
} from '../../../platform/prisma/generated';
import type { OrderBusinessType } from '../../../platform/prisma/generated';

const DEFAULT_PAYMENT_CURRENCY = 'USD';

export type MembershipPlanWithLevel = Prisma.membership_plansGetPayload<{
  include: { level: true };
}>;

export type UserMembershipWithLevel = Prisma.user_membershipsGetPayload<{
  include: { level: true };
}>;

@Injectable()
export class OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async runInTransaction<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(callback);
  }

  async findById(id: string): Promise<orders | null> {
    return this.prisma.orders.findUnique({ where: { id } });
  }

  async findByIdOrThrow(id: string): Promise<orders> {
    const order = await this.prisma.orders.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('订单不存在');
    return order;
  }

  async findByOrderNo(orderNo: string): Promise<orders | null> {
    return this.prisma.orders.findUnique({ where: { orderNo } });
  }

  async findFirstPaidMembershipOrder(userId: string): Promise<orders | null> {
    return this.prisma.orders.findFirst({
      where: { userId, status: OrderStatus.PAID, orderType: OrderType.MEMBERSHIP },
    });
  }

  async findReusablePendingOrder(input: {
    userId: string;
    orderType: OrderType;
    productId: string;
    currency: string;
  }): Promise<orders | null> {
    const orders = await this.prisma.orders.findMany({
      where: {
        userId: input.userId,
        orderType: input.orderType,
        productId: input.productId,
        currency: input.currency,
        status: OrderStatus.PENDING,
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });
    return orders[0] ?? null;
  }

  async findMembershipPlanWithLevel(id: string): Promise<MembershipPlanWithLevel | null> {
    return this.prisma.membership_plans.findUnique({
      where: { id },
      include: { level: true },
    });
  }

  async findMembershipPlan(id: string): Promise<membership_plans | null> {
    return this.prisma.membership_plans.findUnique({ where: { id } });
  }

  async findUserMembershipWithLevel(userId: string): Promise<UserMembershipWithLevel | null> {
    return this.prisma.user_memberships.findUnique({
      where: { userId },
      include: { level: true },
    });
  }

  async findPointsPackage(id: string): Promise<points_packages | null> {
    return this.prisma.points_packages.findUnique({ where: { id } });
  }

  async findMany(
    where: Prisma.ordersWhereInput,
    options?: { skip?: number; take?: number; orderBy?: Prisma.ordersOrderByWithRelationInput },
  ) {
    return this.prisma.orders.findMany({
      where,
      orderBy: options?.orderBy ?? { createdAt: 'desc' },
      skip: options?.skip,
      take: options?.take,
    });
  }

  async count(where: Prisma.ordersWhereInput): Promise<number> {
    return this.prisma.orders.count({ where });
  }

  async create(
    userId: string,
    data: {
      orderType: OrderType;
      businessType?: OrderBusinessType;
      productId: string;
      productName: string;
      originalPrice: Prisma.Decimal;
      amount: Prisma.Decimal;
      isFirstTime: boolean;
      currency?: string;
    },
  ): Promise<orders> {
    const random4 = String(Math.floor(1000 + Math.random() * 9000));
    const orderNo = `ORD${Date.now()}${random4}`;

    return this.prisma.orders.create({
      data: {
        userId,
        orderNo,
        orderType: data.orderType,
        businessType: data.businessType,
        productId: data.productId,
        productName: data.productName,
        originalPrice: data.originalPrice,
        amount: data.amount,
        isFirstTime: data.isFirstTime,
        currency: data.currency ?? DEFAULT_PAYMENT_CURRENCY,
        status: 'PENDING',
      },
    });
  }

  async updateStatus(id: string, status: OrderStatus): Promise<orders> {
    return this.prisma.orders.update({
      where: { id },
      data: { status },
    });
  }

  async update(id: string, data: Prisma.ordersUpdateInput): Promise<orders> {
    return this.prisma.orders.update({ where: { id }, data });
  }

  async lockWithinTx(tx: Prisma.TransactionClient, orderId: string): Promise<orders> {
    await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${orderId} FOR UPDATE`;
    const order = await tx.orders.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    return order;
  }

  async updateWithinTx(
    tx: Prisma.TransactionClient,
    id: string,
    data: Prisma.ordersUpdateInput,
  ): Promise<orders> {
    return tx.orders.update({ where: { id }, data });
  }

  async findByIdWithinTx(tx: Prisma.TransactionClient, id: string): Promise<orders | null> {
    return tx.orders.findUnique({ where: { id } });
  }

  async findByIdWithinTxOrThrow(tx: Prisma.TransactionClient, id: string): Promise<orders> {
    const order = await this.findByIdWithinTx(tx, id);
    if (!order) throw new NotFoundException('订单不存在');
    return order;
  }

  async findByOrderNoWithinTx(tx: Prisma.TransactionClient, orderNo: string): Promise<orders | null> {
    return tx.orders.findUnique({ where: { orderNo } });
  }

  async findByExternalPaymentWithinTx(
    tx: Prisma.TransactionClient,
    provider: string,
    externalPaymentId: string,
  ): Promise<orders | null> {
    return tx.orders.findFirst({
      where: { paymentProvider: provider, externalPaymentId },
    });
  }

  async markFulfilledWithinTx(
    tx: Prisma.TransactionClient,
    id: string,
    fulfilledAt = new Date(),
  ): Promise<orders> {
    return this.updateWithinTx(tx, id, { fulfilledAt });
  }

  async clearPendingMembershipChangeForOrderWithinTx(
    tx: Prisma.TransactionClient,
    order: Pick<orders, 'id' | 'userId'>,
  ): Promise<Prisma.BatchPayload> {
    return tx.user_memberships.updateMany({
      where: { userId: order.userId, pendingOrderId: order.id },
      data: {
        pendingPlanId: null,
        pendingOrderId: null,
        pendingLevelId: null,
        pendingBillingCycle: null,
        pendingAutoRenew: null,
        pendingChangeEffectiveAt: null,
        pendingChangeRequestedAt: null,
      },
    });
  }

  async findMembershipPlanWithLevelWithinTx(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<MembershipPlanWithLevel | null> {
    return tx.membership_plans.findUnique({
      where: { id },
      include: { level: true },
    });
  }

  async findMembershipPlanWithinTx(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<membership_plans | null> {
    return tx.membership_plans.findUnique({ where: { id } });
  }

  async findUserMembershipWithLevelWithinTx(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<UserMembershipWithLevel | null> {
    return tx.user_memberships.findUnique({
      where: { userId },
      include: { level: true },
    });
  }

  async updateUserMembershipByUserIdWithinTx(
    tx: Prisma.TransactionClient,
    userId: string,
    data: Prisma.user_membershipsUncheckedUpdateInput,
  ): Promise<user_memberships> {
    return tx.user_memberships.update({
      where: { userId },
      data,
    });
  }

  async upsertUserMembershipByUserIdWithinTx(
    tx: Prisma.TransactionClient,
    userId: string,
    data: {
      create: Prisma.user_membershipsUncheckedCreateInput;
      update: Prisma.user_membershipsUncheckedUpdateInput;
    },
  ): Promise<user_memberships> {
    return tx.user_memberships.upsert({
      where: { userId },
      create: data.create,
      update: data.update,
    });
  }

  async findPointGrantByOrderEventsWithinTx(
    tx: Prisma.TransactionClient,
    orderId: string,
    sourceEvents: PointLedgerEventType[],
  ): Promise<point_grants | null> {
    return tx.point_grants.findFirst({
      where: {
        sourceId: orderId,
        sourceEvent: { in: sourceEvents },
      },
    });
  }

  async findPointGrantsByOrderEventsWithinTx(
    tx: Prisma.TransactionClient,
    orderId: string,
    sourceEvents: PointLedgerEventType[],
  ): Promise<point_grants[]> {
    return tx.point_grants.findMany({
      where: {
        sourceId: orderId,
        sourceEvent: { in: sourceEvents },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updatePointGrantWithinTx(
    tx: Prisma.TransactionClient,
    id: string,
    data: Prisma.point_grantsUpdateInput,
  ): Promise<point_grants> {
    return tx.point_grants.update({ where: { id }, data });
  }

  async findPointsPackageWithinTx(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<points_packages | null> {
    return tx.points_packages.findUnique({ where: { id } });
  }

  async updateUserPointsWithinTx(
    tx: Prisma.TransactionClient,
    userId: string,
    data: Prisma.user_pointsUpdateInput,
  ): Promise<user_points> {
    return tx.user_points.update({ where: { userId }, data });
  }

  async createPointsRecordWithinTx(
    tx: Prisma.TransactionClient,
    data: Prisma.points_recordsUncheckedCreateInput,
  ): Promise<points_records> {
    return tx.points_records.create({ data });
  }
}
