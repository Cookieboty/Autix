import { Injectable } from '@nestjs/common';
import { AppLogger } from '../../platform/common/app-logger';
import {
  VideoClipStatus,
  VideoProjectStatus,
} from '../../platform/prisma/generated';
import { VideoProjectRepository } from './video-project.repository';

@Injectable()
export class VideoProjectStatusConvergenceService {
  private readonly logger = new AppLogger(
    VideoProjectStatusConvergenceService.name,
  );

  constructor(private readonly repository: VideoProjectRepository) {}

  /**
   * project status 单一收敛入口。
   * 规则（迁就现有 enum，无 partial_failed）：
   *  - 任意 generating/pending → generating
   *  - 全部 failed → failed
   *  - 含 completed（部分成功也算）→ completed
   *  - 否则保留 draft
   */
  async recalculateProjectStatus(projectId: string) {
    const clips = await this.repository.findProjectClipStatuses(projectId);
    if (clips.length === 0) return;

    const has = (status: VideoClipStatus) =>
      clips.some((clip) => clip.status === status);
    const all = (status: VideoClipStatus) =>
      clips.every((clip) => clip.status === status);

    let next: VideoProjectStatus;
    if (has(VideoClipStatus.generating) || has(VideoClipStatus.pending)) {
      next = VideoProjectStatus.generating;
    } else if (all(VideoClipStatus.failed)) {
      next = VideoProjectStatus.failed;
    } else if (has(VideoClipStatus.completed)) {
      next = VideoProjectStatus.completed;
    } else {
      next = VideoProjectStatus.draft;
    }

    await this.repository.updateProjectStatus(projectId, next);
  }

  async convergeAfterClipFailure(args: { clipId: string; projectId: string }) {
    await this.cascadeFailDependents(args.clipId);
    await this.recalculateProjectStatus(args.projectId);
  }

  /**
   * 链段级联失败。
   * 当 brokenClip 失败时，沿"order 严格连续 + chainFromPrev=true + status=pending"的尾部链段
   * 批量标记为 failed，避免它们永远卡在 pending（前置依赖 lastFrame 已不可得）。
   * 严格停在第一处独立 head 或不连续 order，绝不跨链误伤。
   */
  async cascadeFailDependents(brokenClipId: string) {
    const cur = await this.repository.findClipCascadeAnchor(brokenClipId);
    if (!cur) return;

    const tail = await this.repository.findPendingTailClips(
      cur.projectId,
      cur.order,
    );

    let prev = cur.order;
    const failIds: string[] = [];
    for (const clip of tail) {
      if (clip.order !== prev + 1) break;
      if (!clip.chainFromPrev) break;
      failIds.push(clip.id);
      prev = clip.order;
    }
    if (failIds.length === 0) return;

    await this.repository.markClipsFailed(failIds);
    this.logger.warn(
      `cascade-failed ${failIds.length} chain clip(s) after broken ${brokenClipId}`,
    );
  }
}
