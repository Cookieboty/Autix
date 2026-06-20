import { Injectable } from '@nestjs/common';
import { Prisma, ResourceType, TemplateStatus } from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';
import type { ResourcePayload } from './resource-migration.service';

type BatchResourceDelegate = {
  findFirst(args: {
    where: { externalId: unknown; sourcePlatform: unknown };
    select: { id: true };
  }): Promise<{ id: string } | null>;
  update(args: { where: { id: string }; data: ResourcePayload | Record<string, unknown> }): Promise<unknown>;
  create(args: { data: ResourcePayload }): Promise<unknown>;
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

  findImportedResource(
    resourceType: ResourceType,
    externalId: unknown,
    sourcePlatform: unknown,
  ) {
    return this.delegateFor(resourceType).findFirst({
      where: { externalId, sourcePlatform },
      select: { id: true },
    });
  }

  updateResource(
    resourceType: ResourceType,
    id: string,
    data: ResourcePayload | Record<string, unknown>,
  ) {
    return this.delegateFor(resourceType).update({ where: { id }, data });
  }

  createImportedResource(
    resourceType: ResourceType,
    userId: string,
    data: ResourcePayload,
  ) {
    return this.delegateFor(resourceType).create({
      data: {
        ...data,
        status: TemplateStatus.PENDING,
        authorId: userId,
        variables: data.variables ?? {},
        tags: data.tags ?? [],
        pointsCost: data.pointsCost ?? 0,
      },
    });
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
