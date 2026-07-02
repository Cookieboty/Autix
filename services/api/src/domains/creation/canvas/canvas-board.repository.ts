import { Injectable } from '@nestjs/common';
import { Prisma } from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';
import type { CanvasAssetRefRecord } from '@autix/domain';

export interface SaveStateOptions {
  createSnapshot?: boolean;
  thumbnailStorageKey?: string | null;
  assetRefs: CanvasAssetRefRecord[];
  keepSnapshots: number;
}

@Injectable()
export class CanvasBoardRepository {
  constructor(private readonly prisma: PrismaService) {}

  createBoard(userId: string, data: { title: string; description?: string }) {
    return this.prisma.canvas_boards.create({
      data: { userId, title: data.title, description: data.description },
    });
  }

  listBoards(userId: string) {
    return this.prisma.canvas_boards.findMany({
      where: { userId, status: { not: 'deleted' } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  findBoard(id: string) {
    return this.prisma.canvas_boards.findUnique({ where: { id } });
  }

  updateBoard(
    id: string,
    data: Prisma.canvas_boardsUpdateInput,
  ) {
    return this.prisma.canvas_boards.update({ where: { id }, data });
  }

  softDeleteBoard(id: string) {
    return this.prisma.canvas_boards.update({ where: { id }, data: { status: 'deleted' } });
  }

  latestSnapshot(boardId: string) {
    return this.prisma.canvas_board_snapshots.findFirst({
      where: { boardId },
      orderBy: { version: 'desc' },
    });
  }

  listSnapshots(boardId: string) {
    return this.prisma.canvas_board_snapshots.findMany({
      where: { boardId },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, thumbnailStorageKey: true, pinned: true, createdAt: true },
    });
  }

  snapshotByVersion(boardId: string, version: number) {
    return this.prisma.canvas_board_snapshots.findUnique({
      where: { boardId_version: { boardId, version } },
    });
  }

  /**
   * Atomically: guard on revision (If-Match), bump it, write the working
   * snapshot (or a milestone), rebuild asset refs, and prune old snapshots.
   * Returns the new revision, or null when the revision guard fails (409).
   */
  async saveStateAtomic(
    boardId: string,
    expectedRevision: number,
    stateJson: Prisma.InputJsonValue,
    opts: SaveStateOptions,
  ): Promise<number | null> {
    return this.prisma.$transaction(async (tx) => {
      const bumped = await tx.canvas_boards.updateMany({
        where: { id: boardId, revision: expectedRevision },
        data: { revision: { increment: 1 }, latestStateUpdatedAt: new Date() },
      });
      if (bumped.count === 0) return null;
      const newRevision = expectedRevision + 1;

      const latest = await tx.canvas_board_snapshots.findFirst({
        where: { boardId },
        orderBy: { version: 'desc' },
      });

      if (opts.createSnapshot || !latest) {
        const version = (latest?.version ?? 0) + 1;
        await tx.canvas_board_snapshots.create({
          data: {
            boardId,
            version,
            state: stateJson,
            thumbnailStorageKey: opts.thumbnailStorageKey ?? undefined,
          },
        });
      } else {
        await tx.canvas_board_snapshots.update({
          where: { id: latest.id },
          data: {
            state: stateJson,
            thumbnailStorageKey: opts.thumbnailStorageKey ?? latest.thumbnailStorageKey,
          },
        });
      }

      await tx.canvas_board_asset_refs.deleteMany({ where: { boardId } });
      if (opts.assetRefs.length > 0) {
        await tx.canvas_board_asset_refs.createMany({
          data: opts.assetRefs.map((r) => ({
            boardId,
            nodeId: r.nodeId,
            refType: r.refType,
            refId: r.refId,
            storageKey: r.storageKey,
            externalUrl: r.externalUrl,
          })),
        });
      }

      await this.pruneSnapshotsTx(tx, boardId, opts.keepSnapshots);
      return newRevision;
    });
  }

  private async pruneSnapshotsTx(
    tx: Prisma.TransactionClient,
    boardId: string,
    keep: number,
  ): Promise<void> {
    const prunable = await tx.canvas_board_snapshots.findMany({
      where: { boardId, pinned: false },
      orderBy: { version: 'desc' },
      select: { id: true },
      skip: keep,
    });
    if (prunable.length > 0) {
      await tx.canvas_board_snapshots.deleteMany({
        where: { id: { in: prunable.map((s) => s.id) } },
      });
    }
  }

  // ─── Actions ──────────────────────────────────────────────────────────

  findActionByIdempotencyKey(boardId: string, idempotencyKey: string) {
    return this.prisma.canvas_board_actions.findUnique({
      where: { boardId_idempotencyKey: { boardId, idempotencyKey } },
    });
  }

  createAction(data: Prisma.canvas_board_actionsUncheckedCreateInput) {
    return this.prisma.canvas_board_actions.create({ data });
  }

  updateAction(id: string, data: Prisma.canvas_board_actionsUpdateInput) {
    return this.prisma.canvas_board_actions.update({ where: { id }, data });
  }

  listActions(boardId: string, status?: string) {
    return this.prisma.canvas_board_actions.findMany({
      where: { boardId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }
}
