import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';
import type { GenerationTaskListQueryDto } from './dto/generation-task-query.dto';

/** 列表返回的列。刻意不含 prompt / paramsSnapshot / upstreamBody —— 见 spec §6 字段切分。 */
const LIST_SELECT = {
  id: true,
  kind: true,
  userId: true,
  status: true,
  model: true,
  provider: true,
  protocolKey: true,
  providerTaskId: true,
  promptLength: true,
  materialCount: true,
  errorStage: true,
  errorClass: true,
  errorCode: true,
  upstreamStatus: true,
  billingStatus: true,
  pointsCost: true,
  holdId: true,
  createdAt: true,
  submittedAt: true,
  queuedAt: true,
  finishedAt: true,
  durationMs: true,
  lateCallbackAt: true,
  videoGenerationId: true,
  imageGenerationId: true,
} as const;

@Injectable()
export class GenerationTaskAdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(query: GenerationTaskListQueryDto): Prisma.generation_tasksWhereInput {
    const where: Prisma.generation_tasksWhereInput = {};
    if (query.kind) where.kind = query.kind;
    if (query.status) where.status = query.status;
    if (query.errorStage) where.errorStage = query.errorStage;
    if (query.userId) where.userId = query.userId;
    if (query.model) where.model = query.model;
    if (query.provider) where.provider = query.provider;
    if (query.errorClass) where.errorClass = query.errorClass;
    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }
    // q 精确匹配两个 id 列（都有索引），不做模糊搜索——那会在大表上退化成顺序扫描。
    if (query.q) where.OR = [{ id: query.q }, { providerTaskId: query.q }];
    return where;
  }

  async list(query: GenerationTaskListQueryDto) {
    const limit = query.limit ?? 20;
    const rows = await this.prisma.generation_tasks.findMany({
      where: this.buildWhere(query),
      select: LIST_SELECT,
      // 复合排序：createdAt 是毫秒精度但仍可能相同，只按它排会让游标跳行/重复。
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
  }

  /** 详情：完整字段 + 计费 join。`point_holds.taskId == generation_tasks.id`（spec §4.2 的统一 ID）。 */
  async findDetail(id: string) {
    const task = await this.prisma.generation_tasks.findUnique({ where: { id } });
    if (!task) return null;

    const hold = await this.prisma.point_holds.findFirst({
      where: { taskId: id },
      orderBy: { createdAt: 'desc' },
    });
    const records = hold
      ? await this.prisma.points_records.findMany({
          where: { holdId: hold.id },
          orderBy: { createdAt: 'desc' },
          take: 20,
        })
      : [];

    return { task, hold, pointsRecords: records };
  }
}
