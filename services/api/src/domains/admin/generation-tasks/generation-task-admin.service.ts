import { HttpStatus, Injectable } from '@nestjs/common';
import { GenerationBillingStatus } from '../../platform/prisma/generated';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';
import type { GenerationTaskListQueryDto } from './dto/generation-task-query.dto';
import {
  GENERATION_TASK_SENSITIVE_KEYS,
  GenerationTaskAdminRepository,
} from './generation-task-admin.repository';

/**
 * 列表禁止外泄的列。repository 的 select 已排除，这里是第二道闸——
 * 与 LIST_SELECT 共享同一个来源（GENERATION_TASK_SENSITIVE_KEYS），避免两处清单漂移。
 */
const LIST_FORBIDDEN_KEYS: readonly string[] = GENERATION_TASK_SENSITIVE_KEYS;

@Injectable()
export class GenerationTaskAdminService {
  constructor(private readonly repository: GenerationTaskAdminRepository) {}

  async list(query: GenerationTaskListQueryDto) {
    const { items, nextCursor } = await this.repository.list(query);
    return {
      items: items.map((item) => {
        const clone: Record<string, unknown> = { ...(item as Record<string, unknown>) };
        for (const key of LIST_FORBIDDEN_KEYS) delete clone[key];
        return clone;
      }),
      nextCursor,
    };
  }

  async getDetail(id: string) {
    const detail = await this.repository.findDetail(id);
    if (!detail) throw new I18nHttpException(HttpStatus.NOT_FOUND, 'admin.generation_task.not_found');

    const { task, hold, pointsRecords } = detail;
    // 脏数据/历史数据探测：billingStatus 已 CONFIRMED（即"计费已完成"）却查不到对应的
    // point_holds 行，说明 hold 被误删或数据迁移遗漏。这类记录不应被静默当作"从未扣费"
    // 呈现给管理员——那会让人误判为漏扣费而去重复扣费。显式标记出来，交给前端/人工判断，
    // 而不是吞掉这个信号。
    const dataInconsistent = task.billingStatus === GenerationBillingStatus.CONFIRMED && !hold;

    return { task, hold, pointsRecords, dataInconsistent };
  }
}
