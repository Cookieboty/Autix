import {
  ForbiddenException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';
import { Prisma } from '../../platform/prisma/generated';
import { MembershipService } from '../../billing/membership/membership.service';
import { CloudflareR2Service } from '../../platform/storage/cloudflare-r2.service';
import {
  type CanvasBoardState,
  type CanvasEntitlement,
  type CanvasNode,
  createEmptyCanvasBoardState,
  extractCanvasAssetRefs,
  measureCanvasState,
  normalizeCanvasBoardState,
  removeOrphanCanvasEdges,
} from '@autix/domain';
import { CanvasBoardRepository } from './canvas-board.repository';
import { buildCanvasEntitlement } from './canvas-state.helpers';
import type { CreateBoardDto } from './dto/create-board.dto';
import type { UpdateBoardDto } from './dto/update-board.dto';
import type { SaveBoardStateDto } from './dto/save-board-state.dto';

const KEEP_SNAPSHOTS = 20;

type BoardRow = NonNullable<Awaited<ReturnType<CanvasBoardRepository['findBoard']>>>;

@Injectable()
export class CanvasBoardService {
  constructor(
    private readonly repository: CanvasBoardRepository,
    private readonly membershipService: MembershipService,
    private readonly r2Service: CloudflareR2Service,
  ) {}

  async computeEntitlement(userId: string): Promise<CanvasEntitlement> {
    const { membership } = await this.membershipService.getUserMembership(userId);
    const active =
      !!membership &&
      membership.status === 'ACTIVE' &&
      !!membership.expiresAt &&
      membership.expiresAt.getTime() > Date.now();
    return buildCanvasEntitlement({
      active,
      levelName: membership?.level?.name ?? null,
      expiresAt: membership?.expiresAt ?? null,
    });
  }

  async listBoards(userId: string) {
    const [items, entitlement] = await Promise.all([
      this.repository.listBoards(userId),
      this.computeEntitlement(userId),
    ]);
    const hydrated = await Promise.all(items.map((b) => this.hydrateBoard(b)));
    return { items: hydrated, entitlement };
  }

  async createBoard(userId: string, dto: CreateBoardDto) {
    const entitlement = await this.computeEntitlement(userId);
    if (!entitlement.canCreateBoard) {
      throw new ForbiddenException(entitlement.reason ?? 'This feature requires an active membership');
    }
    const board = await this.repository.createBoard(userId, dto);
    return { board: await this.hydrateBoard(board), entitlement };
  }

  async getBoard(userId: string, id: string) {
    const board = await this.assertOwned(userId, id);
    return { board: await this.hydrateBoard(board), entitlement: await this.computeEntitlement(userId) };
  }

  async updateBoard(userId: string, id: string, dto: UpdateBoardDto) {
    await this.assertOwned(userId, id);
    const data: Prisma.canvas_boardsUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.coverStorageKey !== undefined) data.coverStorageKey = dto.coverStorageKey;
    if (dto.status !== undefined) data.status = dto.status;
    const board = await this.repository.updateBoard(id, data);
    return { board: await this.hydrateBoard(board) };
  }

  async deleteBoard(userId: string, id: string) {
    await this.assertOwned(userId, id);
    await this.repository.softDeleteBoard(id);
    return { success: true };
  }

  async getState(userId: string, id: string) {
    const board = await this.assertOwned(userId, id);
    const entitlement = await this.computeEntitlement(userId);
    const state = await this.loadState(board);
    const [hydratedState, hydratedBoard, actions] = await Promise.all([
      this.hydrateState(state),
      this.hydrateBoard(board),
      this.repository.listActions(id, 'running'),
    ]);
    return { board: hydratedBoard, state: hydratedState, entitlement, actions };
  }

  async saveState(userId: string, id: string, dto: SaveBoardStateDto, ifMatch?: string) {
    const board = await this.assertOwned(userId, id);
    const entitlement = await this.computeEntitlement(userId);
    if (!entitlement.canSave) {
      throw new ForbiddenException(entitlement.reason ?? 'No permission to save');
    }
    if (ifMatch === undefined || ifMatch === null || ifMatch === '') {
      throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'creation.canvas.missing_if_match');
    }
    const expectedRevision = Number.parseInt(ifMatch, 10);
    if (!Number.isFinite(expectedRevision)) {
      throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'creation.canvas.invalid_if_match');
    }

    let state = normalizeCanvasBoardState(dto.state);
    state = removeOrphanCanvasEdges(state);

    const size = measureCanvasState(state);
    if (size.overLimit) {
      throw new I18nHttpException(
        HttpStatus.PAYLOAD_TOO_LARGE,
        'creation.canvas.board_too_large',
        undefined,
        {
          data: {
            limit: { maxNodes: 1000, maxStateBytes: 5 * 1024 * 1024 },
            current: { nodes: size.nodes, bytes: size.bytes },
          },
        },
      );
    }

    const persisted: CanvasBoardState = { ...state, boardRevision: expectedRevision + 1 };
    const assetRefs = extractCanvasAssetRefs(persisted);

    const newRevision = await this.repository.saveStateAtomic(
      id,
      expectedRevision,
      persisted as unknown as Prisma.InputJsonValue,
      {
        createSnapshot: dto.createSnapshot,
        thumbnailStorageKey: dto.thumbnailStorageKey ?? null,
        assetRefs,
        keepSnapshots: KEEP_SNAPSHOTS,
      },
    );

    if (newRevision === null) {
      const fresh = await this.repository.findBoard(id);
      const serverState = fresh ? await this.hydrateState(await this.loadState(fresh)) : null;
      throw new I18nHttpException(
        HttpStatus.CONFLICT,
        'creation.canvas.board_updated_elsewhere',
        undefined,
        { data: { serverRevision: fresh?.revision ?? board.revision, serverState } },
      );
    }

    return { boardRevision: newRevision, state: { ...persisted, boardRevision: newRevision } };
  }

  async listVersions(userId: string, id: string) {
    await this.assertOwned(userId, id);
    return { items: await this.repository.listSnapshots(id) };
  }

  async restoreVersion(userId: string, id: string, version: number) {
    const board = await this.assertOwned(userId, id);
    const snapshot = await this.repository.snapshotByVersion(id, version);
    if (!snapshot) throw new I18nHttpException(HttpStatus.NOT_FOUND, 'creation.canvas.version_not_found');
    const restored = normalizeCanvasBoardState(snapshot.state as unknown as Partial<CanvasBoardState>);
    const assetRefs = extractCanvasAssetRefs(restored);
    const newRevision = await this.repository.saveStateAtomic(
      id,
      board.revision,
      { ...restored, boardRevision: board.revision + 1 } as unknown as Prisma.InputJsonValue,
      { createSnapshot: true, thumbnailStorageKey: null, assetRefs, keepSnapshots: KEEP_SNAPSHOTS },
    );
    if (newRevision === null) throw new I18nHttpException(HttpStatus.CONFLICT, 'creation.canvas.restore_conflict');
    return { boardRevision: newRevision, state: await this.hydrateState({ ...restored, boardRevision: newRevision }) };
  }

  /**
   * Server-authoritative merge used by action completion: reload the latest
   * state, apply a pure transform, and save atomically — retrying if a
   * concurrent client save moved the revision. The client's stale autosave
   * can never clobber this because it carries an older If-Match.
   */
  async applyAuthoritativeMerge(
    boardId: string,
    build: (state: CanvasBoardState, nextRevision: number) => CanvasBoardState,
  ): Promise<{ boardRevision: number; state: CanvasBoardState }> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const board = await this.repository.findBoard(boardId);
      if (!board) throw new I18nHttpException(HttpStatus.NOT_FOUND, 'creation.canvas.board_not_found');
      const current = await this.loadState(board);
      const next = build(current, board.revision + 1);
      const assetRefs = extractCanvasAssetRefs(next);
      const rev = await this.repository.saveStateAtomic(
        boardId,
        board.revision,
        next as unknown as Prisma.InputJsonValue,
        { createSnapshot: true, thumbnailStorageKey: null, assetRefs, keepSnapshots: KEEP_SNAPSHOTS },
      );
      if (rev !== null) return { boardRevision: rev, state: next };
    }
    throw new I18nHttpException(HttpStatus.CONFLICT, 'creation.canvas.merge_conflict');
  }

  async loadStateById(userId: string, id: string): Promise<CanvasBoardState> {
    const board = await this.assertOwned(userId, id);
    return this.loadState(board);
  }

  // ─── internals ────────────────────────────────────────────────────────

  private async assertOwned(userId: string, id: string): Promise<BoardRow> {
    const board = await this.repository.findBoard(id);
    if (!board || board.status === 'deleted') throw new I18nHttpException(HttpStatus.NOT_FOUND, 'creation.canvas.board_not_found');
    if (board.userId !== userId) throw new I18nHttpException(HttpStatus.FORBIDDEN, 'creation.canvas.board_forbidden');
    return board;
  }

  private async loadState(board: BoardRow): Promise<CanvasBoardState> {
    const snapshot = await this.repository.latestSnapshot(board.id);
    if (!snapshot) return createEmptyCanvasBoardState(board.revision);
    const state = normalizeCanvasBoardState(snapshot.state as unknown as Partial<CanvasBoardState>);
    return { ...state, boardRevision: board.revision };
  }

  private async hydrateBoard(board: BoardRow) {
    const resolvedCoverImageUrl = board.coverStorageKey
      ? await this.r2Service.getPublicUrl(board.coverStorageKey)
      : null;
    return {
      id: board.id,
      userId: board.userId,
      title: board.title,
      description: board.description,
      coverStorageKey: board.coverStorageKey,
      resolvedCoverImageUrl,
      visibility: board.visibility,
      status: board.status,
      revision: board.revision,
      createdAt: board.createdAt.toISOString(),
      updatedAt: board.updatedAt.toISOString(),
    };
  }

  /** Resolve fresh accessible URLs from stable refs; never persisted. */
  private async hydrateState(state: CanvasBoardState): Promise<CanvasBoardState> {
    const nodes = await Promise.all(state.nodes.map((node) => this.hydrateNode(node)));
    return { ...state, nodes };
  }

  private async hydrateNode(node: CanvasNode): Promise<CanvasNode> {
    if (node.kind !== 'image' && node.kind !== 'video' && node.kind !== 'material') {
      return node;
    }
    const ref = node.assetRef;
    if (!ref) return node;
    let resolvedUrl: string | null = null;
    if (ref.type === 'external') {
      resolvedUrl = ref.url;
    } else if ('storageKey' in ref && ref.storageKey) {
      resolvedUrl = await this.r2Service.getPublicUrl(ref.storageKey);
    }
    return { ...node, resolvedUrl, resolvedThumbnailUrl: node.resolvedThumbnailUrl ?? resolvedUrl };
  }
}
