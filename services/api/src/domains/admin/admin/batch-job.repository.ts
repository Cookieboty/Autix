import { Injectable } from '@nestjs/common';
import { Prisma, ResourceType } from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';
import type { ResourcePayload } from './resource-migration.service';

type BatchResourceDelegate = {
  update(args: { where: { id: string }; data: ResourcePayload | Record<string, unknown> }): Promise<unknown>;
  delete(args: { where: { id: string } }): Promise<unknown>;
};

@Injectable()
export class BatchJobRepository {
  constructor(private readonly prisma: PrismaService) {}

  createJob(data: Prisma.batch_jobsUncheckedCreateInput) {
    return this.prisma.batch_jobs.create({ data });
  }

  findJob(jobId: string) {
    return this.prisma.batch_jobs.findUnique({ where: { id: jobId } });
  }

  async listJobs(userId: string, page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.prisma.batch_jobs.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.batch_jobs.count({ where: { userId } }),
    ]);
    return { items, total, page, pageSize };
  }

  updateJob(jobId: string, data: Prisma.batch_jobsUncheckedUpdateInput) {
    return this.prisma.batch_jobs.update({
      where: { id: jobId },
      data,
    });
  }

  updateResource(
    resourceType: ResourceType,
    id: string,
    data: ResourcePayload | Record<string, unknown>,
  ) {
    return this.delegateFor(resourceType).update({ where: { id }, data });
  }

  deleteResource(resourceType: ResourceType, id: string) {
    return this.delegateFor(resourceType).delete({ where: { id } });
  }

  private delegateFor(resourceType: ResourceType) {
    return (
      resourceType === ResourceType.IMAGE_TEMPLATE
        ? this.prisma.image_templates
        : this.prisma.video_templates
    ) as unknown as BatchResourceDelegate;
  }
}
