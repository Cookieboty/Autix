import { HttpStatus } from '@nestjs/common';
import { ProfileMediaPresignService } from './profile-media-presign.service';
import { StorageCleanupService } from './storage-cleanup.service';
import { AuthIdentityRepository } from '../../identity/auth/auth-identity.repository';

/**
 * T17: 头像上传 reservation-then-consume 全链路 integration spec。
 *
 * 遵循仓库既有约定（见 pricing-cutover.integration.spec.ts）：
 * - real classes wired together：ProfileMediaPresignService + AuthIdentityRepository.consumeAvatarReservation
 *   + StorageCleanupService.expirePendingReservations/enqueue
 * - 只 mock Prisma（in-memory pending_uploads / user / storage_cleanup_tasks 三张表的最小语义）
 *   和 R2（只回本地假 uploadUrl，不发真实 HTTP）
 * - 用于捕获 per-unit mocks 无法覆盖的联动 bug：事务边界、状态转移、跨 service 调用
 *
 * 三条 case（对应 T17.3/T17.4/T17.5）：
 *   A. 正向消费：presign → consume → user 表落 avatar+avatarStorageKey，reservation 置 CONSUMED
 *   B. 过期扫描：presign 后不消费 → 时钟前进 → expirePendingReservations 转 EXPIRED + enqueue PENDING_UPLOAD_EXPIRED
 *   C. 越权：用户 A presign 出的 storageKey 被用户 B consume → BadRequestException + reservation 保持 PENDING
 */

// ─────────────────────────────────────────────────────────────
// In-memory Prisma stub —— 只实现本次 e2e 需要的最小 API surface
// ─────────────────────────────────────────────────────────────

interface PendingUploadRow {
  id: string;
  ownerUserId: string;
  storageKey: string;
  contentType: string;
  sizeBytes: number | null;
  purpose: 'AVATAR' | 'GENERIC';
  status: 'PENDING' | 'CONSUMED' | 'EXPIRED';
  storageBucket: string | null;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

interface UserRow {
  id: string;
  status: 'ACTIVE' | 'DELETED' | 'DISABLED' | 'LOCKED';
  avatar: string | null;
  avatarStorageKey: string | null;
}

interface CleanupTaskRow {
  id: string;
  storageKey: string;
  ownerUserId: string | null;
  reason: string;
  storageBucket: string | null;
  status: string;
  createdAt: Date;
}

function createStubPrisma(users: UserRow[]) {
  const pending: PendingUploadRow[] = [];
  const cleanup: CleanupTaskRow[] = [];
  let seq = 0;
  const nextId = () => `row-${++seq}`;

  const matchPendingWhere = (row: PendingUploadRow, where: Record<string, unknown>): boolean => {
    for (const [k, v] of Object.entries(where)) {
      if (k === 'expiresAt' && v && typeof v === 'object' && 'gt' in (v as any)) {
        if (!(row.expiresAt > (v as { gt: Date }).gt)) return false;
        continue;
      }
      if (k === 'expiresAt' && v && typeof v === 'object' && 'lt' in (v as any)) {
        if (!(row.expiresAt < (v as { lt: Date }).lt)) return false;
        continue;
      }
      if ((row as any)[k] !== v) return false;
    }
    return true;
  };

  const pendingUploads = {
    create: vi.fn(async ({ data }: { data: any }) => {
      const row: PendingUploadRow = {
        id: nextId(),
        ownerUserId: data.ownerUserId,
        storageKey: data.storageKey,
        contentType: data.contentType,
        sizeBytes: data.sizeBytes ?? null,
        purpose: data.purpose,
        status: data.status,
        storageBucket: data.storageBucket ?? null,
        expiresAt: data.expiresAt,
        consumedAt: null,
        createdAt: new Date(),
      };
      pending.push(row);
      return row;
    }),
    findMany: vi.fn(async ({ where, take, select }: any = {}) => {
      const matched = pending.filter((r) => matchPendingWhere(r, where ?? {}));
      const sliced = typeof take === 'number' ? matched.slice(0, take) : matched;
      if (!select) return sliced;
      return sliced.map((r) => {
        const projected: Record<string, unknown> = {};
        for (const k of Object.keys(select)) if (select[k]) projected[k] = (r as any)[k];
        return projected;
      });
    }),
    updateMany: vi.fn(async ({ where, data }: any) => {
      let count = 0;
      for (const row of pending) {
        if (!matchPendingWhere(row, where ?? {})) continue;
        Object.assign(row, data);
        count += 1;
      }
      return { count };
    }),
    findFirst: vi.fn(async ({ where }: any = {}) => {
      return pending.find((r) => matchPendingWhere(r, where ?? {})) ?? null;
    }),
  };

  const userTable = {
    findUnique: vi.fn(async ({ where }: any) => {
      return users.find((u) => u.id === where.id) ?? null;
    }),
    update: vi.fn(async ({ where, data }: any) => {
      const target = users.find((u) => u.id === where.id);
      if (!target) throw new Error('user not found');
      Object.assign(target, data);
      return target;
    }),
  };

  const storageCleanupTasks = {
    create: vi.fn(async ({ data }: { data: any }) => {
      const row: CleanupTaskRow = {
        id: nextId(),
        storageKey: data.storageKey,
        ownerUserId: data.ownerUserId ?? null,
        reason: data.reason,
        storageBucket: data.storageBucket ?? null,
        status: 'PENDING',
        createdAt: new Date(),
      };
      cleanup.push(row);
      return row;
    }),
    createMany: vi.fn(async ({ data }: { data: any[] }) => {
      for (const item of data) await storageCleanupTasks.create({ data: item });
      return { count: data.length };
    }),
  };

  const prisma: any = {
    pending_uploads: pendingUploads,
    user: userTable,
    storage_cleanup_tasks: storageCleanupTasks,
    $queryRaw: vi.fn(async (_query: TemplateStringsArray, userId: string) => {
      const user = users.find((item) => item.id === userId);
      return user ? [{ status: user.status, avatarStorageKey: user.avatarStorageKey }] : [];
    }),
    // consumeAvatarReservation 走 $transaction(async (tx) => ...)
    // in-memory stub 用同一份 prisma 当 tx，事务边界靠上层 throw 触发 rollback。
    // 我们的三条 case 不需要真的验证 rollback（unit spec 已覆盖），只要 tx 能透传即可。
    $transaction: vi.fn(async (fn: any) => fn(prisma)),
  };

  return { prisma, pending, cleanup, users };
}

function createStubR2() {
  return {
    createPresignedUpload: vi.fn(async ({ folder, fileName, contentType }: any) => {
      // 模拟 R2 生成的 key 与 URL；key 前缀强制含 userId，让 keyBelongsToOwner 校验通过
      const key = `${folder}/${Date.now()}-${fileName}`;
      return {
        uploadUrl: `https://r2.mock.local/${key}?sig=fake`,
        publicUrl: `https://cdn.mock.local/${key}`,
        key,
      };
    }),
    getPublicUrl: vi.fn(async (key: string) => `https://cdn.mock.local/${key}`),
  } as any;
}

// ─────────────────────────────────────────────────────────────
// Spec
// ─────────────────────────────────────────────────────────────

describe('T17: avatar upload reservation-then-consume integration', () => {
  it('A. 正向链路：presign → consume 全链路落库、reservation → CONSUMED、user.avatar/avatarStorageKey 就位', async () => {
    const users: UserRow[] = [{ id: 'user-1', status: 'ACTIVE', avatar: null, avatarStorageKey: null }];
    const { prisma, pending } = createStubPrisma(users);
    const r2 = createStubR2();

    const avatarPresign = new ProfileMediaPresignService(prisma, r2);
    const identityRepo = new AuthIdentityRepository(prisma);

    // Step 1: presign —— 端点应写入 pending_uploads PENDING
    const reservation = await avatarPresign.presign('user-1', {
      fileName: 'me.png',
      contentType: 'image/png',
      sizeBytes: 12345,
    });
    expect(reservation.uploadUrl).toContain('r2.mock.local');
    expect(reservation.storageKey).toContain('avatars/user-1/');
    expect(pending).toHaveLength(1);
    expect(pending[0].status).toBe('PENDING');
    expect(pending[0].ownerUserId).toBe('user-1');
    expect(pending[0].purpose).toBe('AVATAR');

    // Step 2: mock 前端 PUT R2 成功（我们不发真实 HTTP，语义上直接跳到 Step 3）
    // Step 3: consumeAvatarReservation —— 事务原子消费 + user 更新
    const publicUrl = await r2.getPublicUrl(reservation.storageKey);
    const { oldStorageKey } = await identityRepo.consumeAvatarReservation(
      'user-1',
      reservation.storageKey,
      publicUrl,
    );

    // 首次上传，无旧 key
    expect(oldStorageKey).toBeNull();
    // reservation 状态推进为 CONSUMED
    expect(pending[0].status).toBe('CONSUMED');
    expect(pending[0].consumedAt).toBeInstanceOf(Date);
    // user 表落 avatar + avatarStorageKey
    expect(users[0].avatar).toBe(publicUrl);
    expect(users[0].avatarStorageKey).toBe(reservation.storageKey);
  });

  it('B. 过期扫描：presign 后不消费 → expirePendingReservations → EXPIRED + enqueue PENDING_UPLOAD_EXPIRED', async () => {
    const users: UserRow[] = [{ id: 'user-1', status: 'ACTIVE', avatar: null, avatarStorageKey: null }];
    const { prisma, pending, cleanup } = createStubPrisma(users);
    const r2 = createStubR2();

    const avatarPresign = new ProfileMediaPresignService(prisma, r2);
    const storageCleanup = new StorageCleanupService(prisma, r2);

    // Step 1: presign
    const reservation = await avatarPresign.presign('user-1', {
      fileName: 'me.png',
      contentType: 'image/png',
      sizeBytes: 1024,
    });
    expect(pending).toHaveLength(1);
    expect(pending[0].status).toBe('PENDING');

    // Step 2: 时钟推进到 reservation.expiresAt 之后（用一个远未来 date，让 findMany where expiresAt<now 命中）
    const farFuture = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const result = await storageCleanup.expirePendingReservations(farFuture, 50);

    expect(result.expired).toBe(1);
    expect(result.enqueued).toBe(1);
    expect(pending[0].status).toBe('EXPIRED');
    // cleanup 队列里应有一条 PENDING_UPLOAD_EXPIRED
    expect(cleanup).toHaveLength(1);
    expect(cleanup[0].reason).toBe('PENDING_UPLOAD_EXPIRED');
    expect(cleanup[0].storageKey).toBe(reservation.storageKey);
    expect(cleanup[0].ownerUserId).toBe('user-1');
  });

  it('C. 越权：用户 A presign 出的 storageKey 由用户 B consume → BadRequestException + reservation 保持 PENDING', async () => {
    const users: UserRow[] = [
      { id: 'user-A', status: 'ACTIVE', avatar: null, avatarStorageKey: null },
      { id: 'user-B', status: 'ACTIVE', avatar: null, avatarStorageKey: null },
    ];
    const { prisma, pending } = createStubPrisma(users);
    const r2 = createStubR2();

    const avatarPresign = new ProfileMediaPresignService(prisma, r2);
    const identityRepo = new AuthIdentityRepository(prisma);

    // 用户 A 拿到自己的 reservation
    const reservationA = await avatarPresign.presign('user-A', {
      fileName: 'a.png',
      contentType: 'image/png',
      sizeBytes: 1024,
    });
    expect(pending).toHaveLength(1);

    // 用户 B 用 A 的 storageKey 尝试消费
    await expect(
      identityRepo.consumeAvatarReservation(
        'user-B',
        reservationA.storageKey,
        'https://cdn.mock.local/hijacked',
      ),
    ).rejects.toMatchObject({
      i18nKey: 'auth.profile.avatar_reservation_invalid',
      status: HttpStatus.BAD_REQUEST,
    });

    // 关键断言：A 的 reservation 仍然是 PENDING（未被 B 越权消费）
    expect(pending[0].status).toBe('PENDING');
    expect(pending[0].ownerUserId).toBe('user-A');
    // 用户 B 的 avatar/avatarStorageKey 均未被写入
    expect(users[1].avatar).toBeNull();
    expect(users[1].avatarStorageKey).toBeNull();
    // 用户 A 的字段也不应因这次越权尝试受影响
    expect(users[0].avatar).toBeNull();
    expect(users[0].avatarStorageKey).toBeNull();
  });
});
