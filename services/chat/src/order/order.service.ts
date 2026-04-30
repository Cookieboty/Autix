import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PointsService } from '../points/points.service';
import { OrderType, Prisma } from '@prisma/client';

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pointsService: PointsService,
  ) {}

  async createOrder(
    userId: string,
    data: {
      orderType: OrderType;
      productId: string;
      productName: string;
      originalPrice: Prisma.Decimal;
      amount: Prisma.Decimal;
      isFirstTime: boolean;
    },
  ) {
    const random4 = String(Math.floor(1000 + Math.random() * 9000));
    const orderNo = `ORD${Date.now()}${random4}`;

    return this.prisma.orders.create({
      data: {
        userId,
        orderNo,
        orderType: data.orderType,
        productId: data.productId,
        productName: data.productName,
        originalPrice: data.originalPrice,
        amount: data.amount,
        isFirstTime: data.isFirstTime,
        status: 'PENDING',
      },
    });
  }

  async getUserOrders(
    userId: string,
    query: { page?: number; pageSize?: number; status?: string; orderType?: OrderType },
  ) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 50);
    const skip = (page - 1) * pageSize;

    const where: any = { userId };
    if (query.status) where.status = query.status;
    if (query.orderType) where.orderType = query.orderType;

    const [items, total] = await Promise.all([
      this.prisma.orders.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.orders.count({ where }),
    ]);

    return { items, total, page, pageSize, hasMore: skip + items.length < total };
  }

  async getOrderById(id: string, userId: string) {
    const order = await this.prisma.orders.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.userId !== userId) throw new ForbiddenException('无权访问此订单');
    return order;
  }

  async cancelOrder(id: string, userId: string) {
    const order = await this.getOrderById(id, userId);
    if (order.status !== 'PENDING') {
      throw new BadRequestException('只能取消待付款的订单');
    }

    return this.prisma.orders.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }
}
