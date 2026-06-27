import { Injectable } from '@nestjs/common';
import { Prisma, ResourceType } from '../platform/prisma/generated';
import { PrismaService } from '../platform/prisma/prisma.service';

type AcquisitionTransaction = Prisma.TransactionClient;

@Injectable()
export class MarketplaceAcquisitionRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAcquisition(userId: string, resourceType: ResourceType, resourceId: string) {
    return this.prisma.user_resource_acquisitions.findUnique({
      where: {
        userId_resourceType_resourceId: {
          userId,
          resourceType,
          resourceId,
        },
      },
    });
  }

  createAcquisitionInTransaction(
    data: {
      userId: string;
      resourceType: ResourceType;
      resourceId: string;
      pointsPaid: number;
    },
    beforeCreate?: (tx: AcquisitionTransaction) => Promise<void>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await beforeCreate?.(tx);
      return tx.user_resource_acquisitions.create({
        data,
      });
    });
  }

  findBalance(userId: string) {
    return this.prisma.user_points.findUnique({
      where: { userId },
    });
  }

  listAcquisitions(userId: string, resourceType?: ResourceType) {
    const where: { userId: string; resourceType?: ResourceType } = { userId };
    if (resourceType) where.resourceType = resourceType;

    return this.prisma.user_resource_acquisitions.findMany({
      where,
      orderBy: { acquiredAt: 'desc' },
    });
  }

  listAcquisitionsPaged(
    userId: string,
    skip: number,
    take: number,
    resourceType?: ResourceType,
  ) {
    const where: { userId: string; resourceType?: ResourceType } = { userId };
    if (resourceType) where.resourceType = resourceType;

    return Promise.all([
      this.prisma.user_resource_acquisitions.findMany({
        where,
        orderBy: { acquiredAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.user_resource_acquisitions.count({ where }),
    ]).then(([rows, total]) => ({ rows, total }));
  }
}
