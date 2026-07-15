import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { createEmptyCanvasBoardState, type CanvasBoardState } from '@autix/domain';
import { CanvasBoardService } from './canvas-board.service';

function activeMembership() {
  return {
    membership: {
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + 1_000_000_000),
      level: { level: 2, name: '金牌' },
    },
    pointsBalance: 100,
  };
}

function expiredMembership() {
  return {
    membership: {
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() - 1000),
      level: { level: 2, name: '金牌' },
    },
    pointsBalance: 0,
  };
}

function build(membership: unknown = activeMembership()) {
  const repo = {
    findBoard: vi.fn(),
    listBoards: vi.fn(),
    createBoard: vi.fn(),
    updateBoard: vi.fn(),
    softDeleteBoard: vi.fn(),
    latestSnapshot: vi.fn().mockResolvedValue(null),
    listSnapshots: vi.fn(),
    snapshotByVersion: vi.fn(),
    saveStateAtomic: vi.fn(),
    listActions: vi.fn(),
  };
  const membershipService = { getUserMembership: vi.fn().mockResolvedValue(membership) };
  const r2 = { getPublicUrl: vi.fn().mockResolvedValue('https://cdn/x.png') };
  const service = new CanvasBoardService(repo as never, membershipService as never, r2 as never);
  return { service, repo, membershipService, r2 };
}

const board = (over: Record<string, unknown> = {}) => ({
  id: 'b1',
  userId: 'u1',
  title: 'T',
  description: null,
  coverStorageKey: null,
  visibility: 'private',
  status: 'active',
  revision: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

const saveDto = (state: CanvasBoardState) => ({ state });

describe('CanvasBoardService', () => {
  it('rejects access to a board owned by another user', async () => {
    const { service, repo } = build();
    repo.findBoard.mockResolvedValue(board({ userId: 'someone-else' }));
    await expect(service.getBoard('u1', 'b1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('degrades entitlement to no-generate when membership expired', async () => {
    const { service } = build(expiredMembership());
    const ent = await service.computeEntitlement('u1');
    expect(ent.canGenerate).toBe(false);
    expect(ent.canSave).toBe(true); // can still view/organize/save
    expect(ent.reason).toBeTruthy();
  });

  it('grants full entitlement to an active member', async () => {
    const { service } = build();
    const ent = await service.computeEntitlement('u1');
    expect(ent.canGenerate).toBe(true);
    expect(ent.canCreateBoard).toBe(true);
  });

  it('requires an If-Match header to save', async () => {
    const { service, repo } = build();
    repo.findBoard.mockResolvedValue(board());
    await expect(
      service.saveState('u1', 'b1', saveDto(createEmptyCanvasBoardState(1)), undefined),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns 409 with server state on a revision conflict', async () => {
    const { service, repo } = build();
    repo.findBoard.mockResolvedValue(board({ revision: 5 }));
    repo.saveStateAtomic.mockResolvedValue(null); // guard failed
    await expect(
      service.saveState('u1', 'b1', saveDto(createEmptyCanvasBoardState(5)), '5'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a state that exceeds the node limit', async () => {
    const { service, repo } = build();
    repo.findBoard.mockResolvedValue(board());
    const huge: CanvasBoardState = {
      ...createEmptyCanvasBoardState(1),
      nodes: Array.from({ length: 1001 }, (_, i) => ({
        id: `n${i}`,
        kind: 'note' as const,
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        createdAt: 't',
        updatedAt: 't',
        text: '',
      })),
    };
    await expect(service.saveState('u1', 'b1', saveDto(huge), '1')).rejects.toBeInstanceOf(
      PayloadTooLargeException,
    );
  });

  it('bumps revision and returns new state on a successful save', async () => {
    const { service, repo } = build();
    repo.findBoard.mockResolvedValue(board({ revision: 3 }));
    repo.saveStateAtomic.mockResolvedValue(4);
    const res = await service.saveState('u1', 'b1', saveDto(createEmptyCanvasBoardState(3)), '3');
    expect(res.boardRevision).toBe(4);
    expect(res.state.boardRevision).toBe(4);
  });
});
