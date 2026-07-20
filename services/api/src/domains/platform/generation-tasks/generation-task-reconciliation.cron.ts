import { Injectable, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AppLogger } from '../common/app-logger';
import { runInJobContext, type JobOutcome } from '../common/job-context';
import { GenerationBillingStatus, GenerationErrorStage, GenerationTaskStatus, PointHoldStatus } from '../prisma/generated';
import { GenerationTaskRepository } from './generation-task.repository';
import { PointsHoldService } from '../../billing/points/services/points-hold.service';

/**
 * 只用于告警阈值，**绝不**驱动状态迁移。60 分钟孤儿回收 cron 阈值 + 10 分钟本
 * cron 调度误差留白。核心不变量：hold=REFUNDED 才是唯一能收敛任务的业务事实；
 * "超过 70 分钟"本身既不证明上游失败，也不证明 hold 已退——hold 仍活跃时如果
 * 据此自动标 EXPIRED，会制造"任务已过期但积分仍冻结"的新不一致。
 */
const STALE_ALERT_MS = 70 * 60 * 1000;

/** 稳定告警前缀，便于日志系统按前缀聚合去重，而不是每条消息都长得不一样。 */
const INVARIANT_PREFIX = 'generation task reconciliation invariant violated';

/** hold 活跃态：仍可能结算，不得据此收敛任务，只在超过阈值时聚合告警。 */
const ACTIVE_HOLD_STATUSES: PointHoldStatus[] = [PointHoldStatus.PENDING, PointHoldStatus.PROCESSING];

interface Violation {
  id: string;
  reason: string;
  ageMs: number;
}

/**
 * 悬挂生成任务收敛 cron：扫描 `status=PENDING AND providerTaskId IS NULL` 的行，
 * 按对应 hold 的**真实状态**分派——不是按任务年龄分派。
 *
 * hold 的定位有两条路：优先 `generation_tasks.holdId`；该字段为 null 时回退按
 * `point_holds.taskId = generation_tasks.id` 反查（回填行与图片侧 start/createHold
 * 窗口内的行都天然没有 holdId，只按 holdId 查会让它们永不收敛）。
 *
 * 完整分派矩阵（见 task-10 brief / spec）：
 * - hold=REFUNDED                         → CAS 标 EXPIRED，errorStage=SUBMIT，billingStatus=REFUNDED
 * - hold=PARTIALLY_REFUNDED               → 不改状态，最高优先级告警（不受年龄门槛限制）
 * - hold=CONFIRMED                        → 不改状态，最高优先级告警（不受年龄门槛限制）
 * - hold=PENDING/PROCESSING 且超过 70 分钟 → 不改状态，聚合告警
 * - 找不到 hold 且超过 70 分钟             → 不改状态，数据完整性告警
 * - hold=CANCELLED/BLOCKED/EXPIRED        → 不改状态，不变量告警（生产代码零引用，出现即说明有未知写入路径）
 * - 孤儿回收 cron（PointsHoldReclaimCron）自身失败 → 不做任何补偿；那是它自己
 *   `job failed:` 告警的职责，本 cron 不越权代偿。
 */
@Injectable()
export class GenerationTaskReconciliationCron {
  constructor(
    private readonly repository: GenerationTaskRepository,
    private readonly holds: PointsHoldService,
    /**
     * 构造器注入便于测试直接断言告警调用，而不必去碰私有字段。Nest 容器里
     * `AppLogger` 从未被注册为 provider，因此必须 `@Optional()`——否则生产环境
     * 启动时 Nest 会因为解析不到该 token 而抛 `UnknownDependenciesException`；
     * `@Optional()` 让 Nest 在解析失败时传入 `undefined`，此时下面的默认值才会
     * 生效（这是纯 JS 语义，与 Nest 的注入逻辑无关）。
     */
    @Optional() private readonly logger: AppLogger = new AppLogger(GenerationTaskReconciliationCron.name),
  ) {}

  @Cron('*/10 * * * *')
  async run(): Promise<JobOutcome> {
    return runInJobContext(
      { name: 'platform.generationTaskReconciliation', logger: this.logger },
      () => this.reconcile(),
    );
  }

  async reconcile(): Promise<JobOutcome> {
    const tasks = await this.repository.findDanglingPending();
    if (tasks.length === 0) return { noop: true };

    const ids = tasks.map((t) => t.holdId).filter((id): id is string => Boolean(id));
    const holdRows = ids.length > 0 ? await this.holds.findByIds(ids) : [];
    const holdById = new Map(holdRows.map((h) => [h.id, h]));

    // holdId 为 null 的行不是"没有 hold"，而是"这一行从来没机会写下 holdId"：
    // Task 2 回填脚本从不写该字段，且图片侧 hold 是 start() 之后才建、要到首次
    // recordBilling(HELD) 才回填。这两类行只按 holdId 查的话永远进不了 REFUNDED
    // 分支——既不朽（清理 cron 刻意不删 PENDING），又每 10 分钟刷一条 hold-missing
    // 告警。反向指针 point_holds.taskId 在两侧都等于 generation_tasks.id（spec §4.2
    // 统一 ID 决策），故回退按 taskId 查。
    const taskIdsWithoutHold = tasks.filter((t) => !t.holdId).map((t) => t.id);
    const holdRowsByTask =
      taskIdsWithoutHold.length > 0 ? await this.holds.findByTaskIds(taskIdsWithoutHold) : [];
    // findByTaskIds 按 createdAt 升序返回，故同一 taskId 有多行时后写入的覆盖先写入的
    // ——留下的是最新 hold。据一个已被新 hold 取代的旧 REFUNDED 收敛，会把仍可能
    // 成功的任务错标成 EXPIRED。
    const holdByTaskId = new Map<string, (typeof holdRowsByTask)[number]>();
    for (const row of holdRowsByTask) {
      if (row.taskId) holdByTaskId.set(row.taskId, row);
    }

    const now = Date.now();
    const violations: Violation[] = [];
    let changed = 0;

    for (const task of tasks) {
      // 70 分钟阈值用 submittedAt；仅当该字段缺失（Task 2 回填的行）时回退 createdAt。
      const anchor = task.submittedAt ?? task.createdAt;
      const ageMs = now - anchor.getTime();
      const hold = task.holdId ? holdById.get(task.holdId) : holdByTaskId.get(task.id);

      if (hold?.status === PointHoldStatus.REFUNDED) {
        // 唯一能驱动状态迁移的业务事实：hold 已确认退款 → 任务不再可能完成，
        // 且计费记录也应如实反映"钱已经退了"。
        const won = await this.repository.claimTerminalStandalone(task.id, {
          status: GenerationTaskStatus.EXPIRED,
          errorStage: GenerationErrorStage.SUBMIT,
          errorMessage: 'submit dangling: hold reclaimed as orphan',
          billingStatus: GenerationBillingStatus.REFUNDED,
        });
        if (won) changed += 1;
        continue;
      }

      if (!hold) {
        // 走到这里意味着两条路都没查到：holdId 指向不存在的行，或 holdId 为空且
        // point_holds 里也没有任何 taskId 指回本行。这是真的数据完整性问题，但也
        // 可能只是刚建行、hold 还没来得及写——所以仍然要求超过年龄阈值才告警。
        if (ageMs >= STALE_ALERT_MS) {
          violations.push({ id: task.id, reason: 'hold-missing', ageMs });
        }
        continue;
      }

      if (hold.status === PointHoldStatus.CONFIRMED) {
        // 已扣费但任务从未提交成功——无论多新都是账不平，最高优先级，不设年龄门槛。
        violations.push({ id: task.id, reason: 'hold-confirmed-but-task-never-submitted', ageMs });
        continue;
      }

      if (hold.status === PointHoldStatus.PARTIALLY_REFUNDED) {
        // 部分退款 + 未完成任务，同样账不平，最高优先级，不设年龄门槛。
        violations.push({ id: task.id, reason: 'hold-partially-refunded', ageMs });
        continue;
      }

      if (ACTIVE_HOLD_STATUSES.includes(hold.status)) {
        // hold 仍活跃（PENDING/PROCESSING）：可能仍在正常处理中，只有超过
        // 年龄阈值才当作异常信号聚合告警——绝不因此改状态。
        if (ageMs >= STALE_ALERT_MS) {
          violations.push({ id: task.id, reason: 'hold-still-active', ageMs });
        }
        continue;
      }

      // 剩下的只有 CANCELLED / BLOCKED / EXPIRED：生产代码零引用这三个枚举值
      // （已核实），出现即说明存在未知写入路径，属结构性不变量违反，不设年龄门槛。
      violations.push({ id: task.id, reason: `unexpected-hold-status-${hold.status}`, ageMs });
    }

    if (violations.length > 0) {
      // 一轮 cron 只打一条聚合 error，避免逐行刷屏；样本只取前 5 个 task id。
      const oldestAgeMs = Math.max(...violations.map((v) => v.ageMs));
      const sample = violations
        .slice(0, 5)
        .map((v) => `${v.id}:${v.reason}`)
        .join(',');
      this.logger.error(
        `${INVARIANT_PREFIX} count=${violations.length} oldestAgeMs=${oldestAgeMs} sample=${sample}`,
      );
    }

    // 注意：发现脏数据**不返回** { failed: true } —— cron 本身执行成功了，只是
    // 发现了异常数据。`failed` 通道严格只表示执行失败，混用会让真正的 job 执行
    // 故障被数据完整性告警淹没（这是本分支早前专门修过的既定口径）。
    return changed > 0 ? { changed } : { noop: true };
  }
}
