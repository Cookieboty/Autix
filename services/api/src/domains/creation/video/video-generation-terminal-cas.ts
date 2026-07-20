import { VideoGenStatus, type Prisma } from '../../platform/prisma/generated';
import { AppLogger } from '../../platform/common/app-logger';

const logger = new AppLogger('claimVideoTerminal');

/**
 * 唯一允许迁出的状态。与 generation_tasks 的 CLAIMABLE_FROM 保持一致。
 *
 * **前提**：`VideoGenStatus` 共六个值（pending / queued / running / completed / failed /
 * expired，见 schema.prisma），此处刻意只收 pending+queued —— 三个终态不可再迁出，而
 * `running` 当前**全仓无任何写入点**，所以不列它是自洽的。
 * 一旦有人（回填脚本、新的上游状态映射、轮询把 running 落库）开始写 `running`，这些行
 * 将**永久无法进入终态**：每次 CAS 都返回 false，调用方整体放弃，hold 只能等 60min 的
 * PointsHoldReclaimCron 孤儿回收。届时必须把 `running` 加进这个数组，而不是绕过 CAS。
 */
const CLAIMABLE_FROM: VideoGenStatus[] = [VideoGenStatus.pending, VideoGenStatus.queued];

export interface VideoTerminalUpdate {
  status: VideoGenStatus;
  /** 上游状态串。终态写入必带，缺省时（如 createTask 同步失败）传 undefined 表示不动这一列。 */
  externalStatus?: string;
  error?: string | null;
  videoUrl?: string | null;
  lastFrameUrl?: string | null;
  thumbnailUrl?: string | null;
  durationSec?: number | null;
  /** 回调/轮询判定终态的时刻。毫秒精度，不取整。 */
  callbackReceivedAt?: Date;
  completedAt?: Date;
}

/**
 * CAS 抢占视频终态。返回 true 表示本次抢到，调用方应在同一事务里继续写业务表；
 * 返回 false 表示已被并发的另一路径写成终态，调用方**必须整体放弃** ——
 * 不写任何表、不确认 hold、不退款、不落素材。
 *
 * 修复既有缺陷：原实现是 update({where:{id}}) 无状态条件，回调与轮询并发时会互相覆盖
 * （两条路都走 applyTaskStatus），且 reconcileIfTerminal 只检查调用方传入的旧对象、
 * 不重读不加锁，拦不住已经跑到写入点的另一路。
 */
export async function claimVideoTerminal(
  tx: Prisma.TransactionClient,
  generationId: string,
  next: VideoTerminalUpdate,
): Promise<boolean> {
  const data: Prisma.video_clip_generationsUpdateManyMutationInput = {
    status: next.status,
  };
  // 逐列只在调用方显式给出时才写：undefined = 不动该列（保持原 update 的语义），
  // null = 显式清空。用 `?? undefined` 会把显式 null 吞掉，故不能用。
  if (next.externalStatus !== undefined) data.externalStatus = next.externalStatus;
  if (next.error !== undefined) data.error = next.error;
  if (next.videoUrl !== undefined) data.videoUrl = next.videoUrl;
  if (next.lastFrameUrl !== undefined) data.lastFrameUrl = next.lastFrameUrl;
  if (next.thumbnailUrl !== undefined) data.thumbnailUrl = next.thumbnailUrl;
  if (next.durationSec !== undefined) data.durationSec = next.durationSec;
  if (next.callbackReceivedAt !== undefined) data.callbackReceivedAt = next.callbackReceivedAt;
  if (next.status === VideoGenStatus.completed) {
    data.completedAt = next.completedAt ?? new Date();
  } else if (next.completedAt !== undefined) {
    data.completedAt = next.completedAt;
  }

  const { count } = await tx.video_clip_generations.updateMany({
    where: { id: generationId, status: { in: CLAIMABLE_FROM } },
    data,
  });
  if (count === 0) {
    // 原实现用 update()，行缺失会抛 P2025；改 updateMany 后两种情况被压成同一个
    // count===0，且无法从 count 本身区分：generationId 已是终态（合理跳过，并发下常见）；
    // 或 generationId 根本不存在（很可能是上游 bug）。这里不做额外查询判断，只把 id 与
    // 目标状态打出来，交给排查者结合上下文判断。写法对齐 generation-task.repository。
    logger.warn(
      `claimVideoTerminal: no row updated (already terminal or id not found) generationId=${generationId} target=${next.status}`,
    );
  }
  return count === 1;
}
