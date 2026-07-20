import { VideoGenStatus, type Prisma } from '../../platform/prisma/generated';

/** 唯一允许迁出的状态。与 generation_tasks 的 CLAIMABLE_FROM 保持一致。 */
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
  return count === 1;
}
