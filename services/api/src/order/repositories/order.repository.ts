import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  OrderStatus,
  OrderType,
  Prisma,
  type orders,
} from '../../prisma/generated';
import type { OrderBusinessType } from '../../prisma/generated';

const DEFAULT_PAYMENT_CURRENCY = 'USD';

@Injectable()
export class OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

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
}
