import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { Prisma } from '../../platform/prisma/generated';

type CreateRegistrationInput = {
  username: string;
  email: string;
  password: string;
  systemId: string;
  registrationStatus: 'PENDING' | 'PENDING_ACTIVATION';
  inviteCode?: string;
  signupIp?: string;
  signupDeviceId?: string;
};

type ActivateRegistrationInput = {
  userId: string;
  registrationId: string;
  roleId: string;
  inviteCode?: string;
};

type CreateUserAccountInput = {
  userId: string;
  provider: string;
  providerAccountId: string;
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt?: Date;
  scope?: string;
  tokenType?: string;
  metadata?: unknown;
};

type CreateOAuthUserInput = {
  username: string;
  email: string;
  avatar?: string;
  realName?: string;
  systemId: string;
  defaultRoleCode: string;
  account: Omit<CreateUserAccountInput, 'userId'>;
  signupIp?: string;
  signupDeviceId?: string;
  inviteCode?: string;
  emailVerified: boolean;
  emailPlaceholder: boolean;
};

@Injectable()
export class AuthIdentityRepository {
  constructor(private readonly prisma: PrismaService) { }

  findLoginUserByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
      include: {
        roles: {
          include: {
            role: {
              include: { system: true },
            },
          },
        },
      },
    });
  }

  findActiveSystems() {
    return this.prisma.system.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { sort: 'asc' },
    });
  }

  findUserByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  findUserByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findUserById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findAuthUserById(userId: string, currentSystemId?: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
          ...(currentSystemId
            ? { where: { role: { systemId: currentSystemId } } }
            : {}),
        },
      },
    });
  }

  findMembershipByUserId(userId: string) {
    return this.prisma.user_memberships.findUnique({
      where: { userId },
    });
  }

  findPasswordResetUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: { id: true, password: true },
    });
  }

  findSystemByCode(code: string) {
    return this.prisma.system.findUnique({ where: { code } });
  }

  findSystemById(id: string) {
    return this.prisma.system.findUnique({ where: { id } });
  }

  createRegistration(input: CreateRegistrationInput) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username: input.username,
          email: input.email,
          password: input.password,
          status: 'PENDING',
          signupIp: input.signupIp,
          signupDeviceId: input.signupDeviceId,
        },
      });

      await tx.systemRegistration.create({
        data: {
          userId: user.id,
          systemId: input.systemId,
          status: input.registrationStatus,
          inviteCode: input.inviteCode,
        },
      });

      return user;
    });
  }

  findPendingActivationRegistration(userId: string) {
    return this.prisma.systemRegistration.findFirst({
      where: { userId, status: 'PENDING_ACTIVATION' },
      include: { system: true },
    });
  }

  findRegistrationByUserAndSystem(userId: string, systemId: string) {
    return this.prisma.systemRegistration.findUnique({
      where: { userId_systemId: { userId, systemId } },
    });
  }

  findRoleBySystemAndCode(systemId: string, code: string) {
    return this.prisma.role.findFirst({
      where: { systemId, code },
    });
  }

  activateRegistration(input: ActivateRegistrationInput) {
    return this.prisma.$transaction(async (tx) => {
      const activated = await tx.user.updateMany({
        where: { id: input.userId, status: { not: 'DELETED' } },
        data: { status: 'ACTIVE' },
      });
      if (activated.count !== 1) throw new BadRequestException({ code: 'USER_DELETED', message: '账户不可用' });

      await tx.systemRegistration.update({
        where: { id: input.registrationId },
        data: {
          status: 'APPROVED',
          processedAt: new Date(),
          inviteCode: input.inviteCode,
        },
      });

      await tx.userRole.upsert({
        where: { userId_roleId: { userId: input.userId, roleId: input.roleId } },
        update: {},
        create: { userId: input.userId, roleId: input.roleId },
      });
    });
  }

  findUserRoleInSystem(userId: string, systemId: string) {
    return this.prisma.userRole.findFirst({
      where: {
        userId,
        role: { systemId },
      },
    });
  }

  resetPasswordAndRevokeSessions(input: {
    userId: string;
    password: string;
    expectedPasswordSuffix: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const users = await tx.$queryRaw<Array<{ status: string; password: string | null }>>`
        SELECT "status", "password" FROM "users" WHERE "id" = ${input.userId} FOR UPDATE
      `;
      const user = users[0];
      if (
        !user ||
        ['DELETED', 'DISABLED', 'LOCKED'].includes(user.status) ||
        !user.password ||
        user.password.slice(-8) !== input.expectedPasswordSuffix
      ) {
        throw new BadRequestException('链接已使用或无效');
      }
      await tx.user.update({ where: { id: input.userId }, data: { password: input.password } });
      await tx.userSession.deleteMany({ where: { userId: input.userId } });
    });
  }

  /**
   * T12: 原子性设置/修改密码 + 吊销非当前会话（spec §3.2 B 硬约束）。
   *
   * 三步必须同事务：
   * 1. 用 `where: { id, status: { not: 'DELETED' } }` 与"另一路径并发匿名化"赛跑。
   *    若并发 sweeper 已把 status 迁到 DELETED，`update` 抛 P2025，事务回滚，proof 消费"未实际生效"
   *    的窗口不存在（proof verify 已发生在事务外，但密码未落库，且非当前会话未被吊销 → 一致回滚）。
   * 2. `user.password` 落库
   * 3. 吊销除 `keepSessionId` 外的所有会话（防止 stale 会话继续使用旧密码泄漏路径）
   *
   * 返回 `{ passwordChanged: true }`；调用方据此产出 message。
   */
  async changePasswordAndRevokeOtherSessions(input: {
    userId: string;
    password: string;
    keepSessionId: string;
    proofJti: string;
    proofPurpose: 'STEP_UP_CHANGE_PASSWORD' | 'STEP_UP_SET_PASSWORD';
  }) {
    return this.prisma.$transaction(async (tx) => {
      const consumedProof = await tx.step_up_proofs.updateMany({
        where: {
          jti: input.proofJti,
          userId: input.userId,
          sessionId: input.keepSessionId,
          purpose: input.proofPurpose,
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { consumedAt: new Date() },
      });
      if (consumedProof.count !== 1) {
        throw new BadRequestException({
          code: 'STEP_UP_INVALID_OR_EXPIRED',
          message: '身份复核凭证无效或已使用',
        });
      }
      try {
        await tx.user.update({
          where: {
            id: input.userId,
            status: { not: 'DELETED' },
          },
          data: { password: input.password },
        });
      } catch (err: any) {
        // P2025：Record to update not found —— 说明 status 已被并发迁到 DELETED
        if (err?.code === 'P2025') {
          throw new BadRequestException('账户不可用');
        }
        throw err;
      }
      await tx.userSession.deleteMany({
        where: { userId: input.userId, NOT: { id: input.keepSessionId } },
      });
    });
  }

  /**
   * T11: 自助 profile 更新（`PATCH auth/profile`）。
   *
   * 关键约束：
   * 1. 事务内先 `SELECT ... FOR UPDATE` 锁定用户，再检查状态并更新，避免与匿名化并发写入。
   * 2. 入参已经在 controller 层被 whitelist DTO 剥离；这里再显式重构造 update data，是
   *    "不信任传入 partial"的第二道防线：即便未来 DTO 加了字段，只要不加到这个 helper 的
   *    白名单里，就写不进 DB。
   * 3. `undefined` 表示"不修改"，`null` 表示"清空"；Prisma `data` 中 `undefined` 会被 driver
   *    自然忽略，所以直接透传 partial 即可。
   */
  async updateOwnProfile(
    userId: string,
    input: {
      nickname?: string | null;
      description?: string | null;
      headline?: string | null;
      location?: string | null;
      socialX?: string | null;
      socialInstagram?: string | null;
      socialYoutube?: string | null;
      socialTiktok?: string | null;
      avatar?: string | null;
    },
  ) {
    // 白名单重构造 —— 只有这些自助字段被落库
    const data: Record<string, unknown> = {};
    const SELF_FIELDS = [
      'nickname',
      'description',
      'headline',
      'location',
      'socialX',
      'socialInstagram',
      'socialYoutube',
      'socialTiktok',
    ] as const;
    for (const field of SELF_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(input, field)) data[field] = input[field];
    }
    if (Object.prototype.hasOwnProperty.call(input, 'avatar')) {
      data.avatar = input.avatar;
      // T16: 走外链路径时同步清空 avatarStorageKey（旧的内部 key 已经不再对应当前头像）
      // 旧 key cleanup 与 profile 更新写入同一事务 outbox。
      if (Object.prototype.hasOwnProperty.call(input, 'avatar')) data.avatarStorageKey = null;
    }

    await this.prisma.$transaction(async (tx) => {
      const users = await tx.$queryRaw<Array<{ status: string; avatarStorageKey: string | null }>>`
        SELECT "status", "avatarStorageKey" FROM "users" WHERE "id" = ${userId} FOR UPDATE
      `;
      const user = users[0];
      if (!user || ['DELETED', 'DISABLED', 'LOCKED'].includes(user.status)) {
        throw new BadRequestException('账户不可用');
      }
      await tx.user.update({ where: { id: userId }, data });
      if (Object.prototype.hasOwnProperty.call(input, 'avatar') && user.avatarStorageKey) {
        await tx.storage_cleanup_tasks.create({
          data: {
            storageKey: user.avatarStorageKey,
            ownerUserId: userId,
            reason: 'AVATAR_REPLACED',
          },
        });
      }
    });
  }

  async assertPendingAvatarReservation(userId: string, storageKey: string): Promise<{
    sizeBytes: number | null;
    contentType: string | null;
  }> {
    const reservation = await this.prisma.pending_uploads.findFirst({
      where: {
        ownerUserId: userId,
        storageKey,
        purpose: 'AVATAR',
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      select: { id: true, sizeBytes: true, contentType: true },
    });
    if (!reservation) throw new BadRequestException('头像上传凭据无效或已过期');
    return {
      sizeBytes: reservation.sizeBytes,
      contentType: reservation.contentType,
    };
  }

  /**
   * T16: 消费头像 reservation。
   *
   * 事务边界：
   * 1. UPDATE pending_uploads SET status='CONSUMED', consumedAt=now
   *    WHERE storageKey=key AND ownerUserId=userId AND purpose='AVATAR'
   *      AND status='PENDING' AND expiresAt>now
   *    → 影响行数=0 时抛 400（超时 / 已消费 / 越权 / 不存在，一律统一错误消息不区分泄露信息）
   * 2. 读回 storageKey 用于拼 publicUrl（由上层 CloudflareR2Service.getPublicUrl 完成）
   * 3. 读旧 user.avatarStorageKey，用于事务外 enqueue AVATAR_REPLACED cleanup task
   * 4. UPDATE user SET avatar=publicUrl, avatarStorageKey=key WHERE id=userId AND status!=DELETED
   *
   * T18: 支持 `finalStorageKey` 参数分离 reservation 校验与实际入库。
   * - reservation 仍按 `reservationStorageKey`（用户 PUT 到 R2 的原 key）匹配 updateMany
   * - user.avatar/avatarStorageKey 落 `finalStorageKey ?? reservationStorageKey`
   *   → 场景：AvatarImageProcessor 处理后写新 key，需要把 user 表落新 key 而不是原 key
   *
   * 返回值：`{ oldStorageKey }` —— 上层根据是否非空 enqueue cleanup。
   * 若消费成功且旧 key 不存在，说明用户之前没有内部头像（外链或从未设置），无需 cleanup。
   */
  async consumeAvatarReservation(
    userId: string,
    reservationStorageKey: string,
    publicUrl: string,
    finalStorageKey?: string,
  ): Promise<{ oldStorageKey: string | null }> {
    const storageKeyToPersist = finalStorageKey ?? reservationStorageKey;
    return this.prisma.$transaction(async (tx) => {
      const users = await tx.$queryRaw<Array<{
        status: string;
        avatarStorageKey: string | null;
      }>>`
        SELECT "status", "avatarStorageKey"
        FROM "users"
        WHERE "id" = ${userId}
        FOR UPDATE
      `;
      const dbUser = users[0];
      if (!dbUser || dbUser.status === 'DELETED' || dbUser.status === 'DISABLED' || dbUser.status === 'LOCKED') {
        throw new BadRequestException('账户不可用');
      }

      // 原子消费：updateMany + 条件 where，避免 findFirst → update 两段式竞态
      const consumed = await tx.pending_uploads.updateMany({
        where: {
          storageKey: reservationStorageKey,
          ownerUserId: userId,
          purpose: 'AVATAR',
          status: 'PENDING',
          expiresAt: { gt: new Date() },
        },
        data: {
          status: 'CONSUMED',
          consumedAt: new Date(),
        },
      });
      if (consumed.count === 0) {
        throw new BadRequestException('头像上传凭据无效或已过期');
      }
      const oldStorageKey = dbUser.avatarStorageKey ?? null;

      await tx.user.update({
        where: { id: userId },
        data: {
          avatar: publicUrl,
          avatarStorageKey: storageKeyToPersist,
        },
      });

      const cleanupTasks = [] as Array<{
        storageKey: string;
        ownerUserId: string;
        reason: 'AVATAR_REPLACED' | 'AVATAR_ORIGINAL_REPLACED';
      }>;
      if (oldStorageKey && oldStorageKey !== storageKeyToPersist) {
        cleanupTasks.push({ storageKey: oldStorageKey, ownerUserId: userId, reason: 'AVATAR_REPLACED' });
      }
      if (storageKeyToPersist !== reservationStorageKey) {
        cleanupTasks.push({
          storageKey: reservationStorageKey,
          ownerUserId: userId,
          reason: 'AVATAR_ORIGINAL_REPLACED',
        });
      }
      if (cleanupTasks.length > 0) {
        await tx.storage_cleanup_tasks.createMany({ data: cleanupTasks });
      }

      return { oldStorageKey };
    });
  }

  async anonymizeUserImmediately(input: {
    userId: string;
    sessionId: string;
    proofJti: string;
    usernameConfirmation: string;
  }): Promise<{ deletedAt: Date }> {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const lockedUsers = await tx.$queryRaw<Array<{
        id: string;
        status: string;
        isSuperAdmin: boolean;
        avatarStorageKey: string | null;
        username: string;
      }>>`
        SELECT "id", "status", "isSuperAdmin", "avatarStorageKey", "username"
        FROM "users"
        WHERE "id" = ${input.userId}
        FOR UPDATE
      `;
      const lockedUser = lockedUsers[0];
      if (!lockedUser || lockedUser.status === 'DELETED') {
        throw new BadRequestException({ code: 'USER_DELETED', message: '账户不可用' });
      }
      if (lockedUser.isSuperAdmin) {
        // spec §3.2 F：超管自删是幂等冲突语义，用 409（而非 400）。
        throw new ConflictException({
          code: 'SUPER_ADMIN_CANNOT_SELF_DELETE',
          message: '超级管理员不能自助删除账号',
        });
      }
      if (lockedUser.username !== input.usernameConfirmation) {
        throw new BadRequestException({
          code: 'ACCOUNT_DELETE_CONFIRMATION_MISMATCH',
          message: '用户名确认不匹配',
        });
      }

      const consumedProof = await tx.step_up_proofs.updateMany({
        where: {
          jti: input.proofJti,
          userId: input.userId,
          sessionId: input.sessionId,
          purpose: 'STEP_UP_DELETE_ACCOUNT',
          consumedAt: null,
          expiresAt: { gt: now },
        },
        data: { consumedAt: now },
      });
      if (consumedProof.count !== 1) {
        throw new BadRequestException({
          code: 'STEP_UP_INVALID_OR_EXPIRED',
          message: '身份复核凭证无效或已使用',
        });
      }

      const pendingUploads = await tx.pending_uploads.findMany({
        where: { ownerUserId: input.userId, status: 'PENDING' },
        select: { storageKey: true, storageBucket: true },
      });
      const cleanupTasks = [
        ...(lockedUser.avatarStorageKey
          ? [{
              storageKey: lockedUser.avatarStorageKey,
              ownerUserId: input.userId,
              reason: 'ACCOUNT_DELETED' as const,
            }]
          : []),
        ...pendingUploads.map((upload) => ({
          storageKey: upload.storageKey,
          storageBucket: upload.storageBucket,
          ownerUserId: input.userId,
          reason: 'PENDING_UPLOAD_EXPIRED' as const,
        })),
      ];
      if (cleanupTasks.length > 0) {
        await tx.storage_cleanup_tasks.createMany({ data: cleanupTasks });
      }

      const likes = await tx.resource_likes.findMany({
        where: { userId: input.userId },
        select: { resourceType: true, resourceId: true },
      });
      const favorites = await tx.resource_favorites.findMany({
        where: { userId: input.userId },
        select: { resourceType: true, resourceId: true },
      });
      const affectedResources = new Map(
        [...likes, ...favorites].map((item) => [
          `${item.resourceType}:${item.resourceId}`,
          item,
        ]),
      );
      const affectedResourceRows = [...affectedResources.values()];
      if (affectedResourceRows.length > 0) {
        const values = Prisma.join(affectedResourceRows.map((item) => Prisma.sql`
          (${item.resourceType}::"ResourceType", ${item.resourceId})
        `));
        await tx.$queryRaw(Prisma.sql`
          SELECT metrics."resourceType", metrics."resourceId"
          FROM "resource_metrics" metrics
          JOIN (VALUES ${values}) AS affected("resourceType", "resourceId")
            ON affected."resourceType" = metrics."resourceType"
           AND affected."resourceId" = metrics."resourceId"
          FOR UPDATE OF metrics
        `);
      }
      await tx.userRole.deleteMany({ where: { userId: input.userId } });
      // spec 删除矩阵 §1 RateLimitCounter：先捕获 session id，供事务末尾 best-effort 清理
      // 该用户全部 session 维度的限流计数（session 维度键不含 userId，LIKE %userId% 覆盖不到）。
      const deletedSessionIds = (
        await tx.userSession.findMany({ where: { userId: input.userId }, select: { id: true } })
      ).map((s) => s.id);
      await tx.userSession.deleteMany({ where: { userId: input.userId } });
      await tx.userAccount.deleteMany({ where: { userId: input.userId } });
      await tx.socialLoginState.deleteMany({ where: { linkUserId: input.userId } });
      await tx.socialLoginCode.deleteMany({ where: { userId: input.userId } });
      await tx.oAuthAuthorizationCode.deleteMany({ where: { userId: input.userId } });
      await tx.email_otps.deleteMany({ where: { userId: input.userId } });
      await tx.step_up_proofs.deleteMany({ where: { userId: input.userId } });
      await tx.systemRegistration.deleteMany({
        where: { userId: input.userId, status: { not: 'APPROVED' } },
      });
      await tx.pending_uploads.deleteMany({ where: { ownerUserId: input.userId } });
      await tx.video_project_shares.deleteMany({ where: { userId: input.userId } });
      await tx.resource_likes.deleteMany({ where: { userId: input.userId } });
      await tx.resource_favorites.deleteMany({ where: { userId: input.userId } });
      await tx.resource_views.updateMany({
        where: { userId: input.userId },
        data: { userId: null },
      });
      await tx.resource_view_events.updateMany({
        where: { OR: [{ userId: input.userId }, { viewerKey: `u:${input.userId}` }] },
        data: { userId: null, visitorId: null, sessionId: null },
      });
      await tx.$executeRaw`
        UPDATE "resource_view_events"
        SET "viewerKey" = 'anon:' || "id"
        WHERE "viewerKey" = ${`u:${input.userId}`}
      `;
      await tx.resource_uv_days.deleteMany({ where: { viewerKey: `u:${input.userId}` } });
      await tx.gallery_comments.updateMany({
        where: { userId: input.userId },
        data: { userId: null },
      });
      // gallery_posts 不再写作者快照：作者身份改由 presentAuthor 依据 User.status==='DELETED'
      // 实时脱敏（见 creation/gallery/gallery-author.presenter.ts），快照字段已随之下线。
      await tx.$executeRaw`UPDATE "task_events" SET "metadata" = NULL WHERE "userId" = ${input.userId}`;
      await tx.$executeRaw`UPDATE "batch_jobs" SET "metadata" = NULL, "errorLog" = NULL WHERE "userId" = ${input.userId}`;
      // 保留财务和风控主状态作为审计锚点，但删除无法证明不含 PII 的自由文本/JSON 载荷。
      await tx.$executeRaw`
        UPDATE "user_risk_profiles"
        SET "topSignals" = NULL, "blockedReason" = NULL
        WHERE "userId" = ${input.userId}
      `;
      await tx.$executeRaw`
        UPDATE "user_risk_events"
        SET "detail" = NULL
        WHERE "userId" = ${input.userId}
      `;
      await tx.$executeRaw`
        UPDATE "orders"
        SET "paymentMetadata" = CASE
              WHEN "paymentMetadata" IS NULL THEN NULL
              ELSE jsonb_strip_nulls(jsonb_build_object(
                'stripePaymentIntentId', "paymentMetadata" -> 'stripePaymentIntentId',
                'stripeCheckoutSessionId', "paymentMetadata" -> 'stripeCheckoutSessionId',
                'subscriptionId', "paymentMetadata" -> 'subscriptionId',
                'data', jsonb_build_object(
                  'object', jsonb_strip_nulls(jsonb_build_object(
                    'id', "paymentMetadata" #> '{data,object,id}',
                    'subscription', "paymentMetadata" #> '{data,object,subscription}',
                    'payment_intent', "paymentMetadata" #> '{data,object,payment_intent}',
                    'customer', "paymentMetadata" #> '{data,object,customer}'
                  ))
                )
              ))
            END,
            "refundMetadata" = CASE
              WHEN "refundMetadata" IS NULL THEN NULL
              ELSE jsonb_strip_nulls(jsonb_build_object(
                'id', "refundMetadata" -> 'id',
                'status', "refundMetadata" -> 'status',
                'amount', "refundMetadata" -> 'amount',
                'currency', "refundMetadata" -> 'currency',
                'pointsReclaimed', "refundMetadata" -> 'pointsReclaimed',
                'skippedConsumedPoints', "refundMetadata" -> 'skippedConsumedPoints',
                'skippedFrozenPoints', "refundMetadata" -> 'skippedFrozenPoints'
              ))
            END,
            "refundReason" = NULL
        WHERE "userId" = ${input.userId}
      `;
      await tx.$executeRaw`
        UPDATE "payment_events"
        SET "payload" = CASE
              WHEN "payload" IS NULL THEN NULL
              ELSE jsonb_strip_nulls(jsonb_build_object(
                'id', "payload" -> 'id',
                'type', "payload" -> 'type',
                'created', "payload" -> 'created',
                'livemode', "payload" -> 'livemode',
                'data', jsonb_build_object(
                  'object', jsonb_strip_nulls(jsonb_build_object(
                    'id', "payload" #> '{data,object,id}',
                    'status', "payload" #> '{data,object,status}',
                    'subscription', "payload" #> '{data,object,subscription}',
                    'payment_intent', "payload" #> '{data,object,payment_intent}',
                    'customer', "payload" #> '{data,object,customer}',
                    'amount_total', "payload" #> '{data,object,amount_total}',
                    'currency', "payload" #> '{data,object,currency}'
                  ))
                )
              ))
            END,
            "errorMessage" = NULL
        WHERE "userId" = ${input.userId}
      `;

      if (affectedResourceRows.length > 0) {
        const values = Prisma.join(affectedResourceRows.map((item) => Prisma.sql`
          (${item.resourceType}::"ResourceType", ${item.resourceId})
        `));
        await tx.$executeRaw(Prisma.sql`
          UPDATE "resource_metrics" metrics
          SET "likeCount" = (
                SELECT COUNT(*)::integer FROM "resource_likes" likes
                WHERE likes."resourceType" = metrics."resourceType"
                  AND likes."resourceId" = metrics."resourceId"
              ),
              "favoriteCount" = (
                SELECT COUNT(*)::integer FROM "resource_favorites" favorites
                WHERE favorites."resourceType" = metrics."resourceType"
                  AND favorites."resourceId" = metrics."resourceId"
              )
          FROM (VALUES ${values}) AS affected("resourceType", "resourceId")
          WHERE affected."resourceType" = metrics."resourceType"
            AND affected."resourceId" = metrics."resourceId"
        `);
      }
      // 删除矩阵 §1：best-effort 清理限流计数。
      // - userId 维度：dimension 含 userId，用 LIKE 覆盖（含 email-change:user / otp-*:user / stepup-pwd:user 等）。
      // - session 维度：dimension 为 otp-request/verify:session:<sid>，不含 userId，用捕获的 session id 精确删除。
      // - 旧邮箱 HMAC 维度（otp-*:emailhash:<hmac>）：为 1h 短窗口且需注入 EmailHashService（会破坏大量直接
      //   实例化 repo 的单测），按矩阵"best-effort + 共享维度按 TTL 保留"允许交由短 TTL + RateLimitCleanupCron 清理。
      await tx.$executeRaw`
        DELETE FROM "rate_limit_counters"
        WHERE "dimension" LIKE ${`%${input.userId}%`}
      `;
      if (deletedSessionIds.length > 0) {
        const sessionDimensions = deletedSessionIds.flatMap((sid) => [
          `otp-request:session:${sid}`,
          `otp-verify:session:${sid}`,
        ]);
        await tx.rate_limit_counters.deleteMany({
          where: { dimension: { in: sessionDimensions } },
        });
      }

      await tx.user.update({
        where: { id: input.userId },
        data: {
          status: 'DELETED',
          deletedAt: now,
          username: `deleted_${input.userId.replace(/-/g, '').slice(0, 20)}`,
          email: `deleted+${input.userId}@deleted.local`,
          emailVerified: false,
          pendingEmail: null,
          password: null,
          realName: null,
          nickname: null,
          description: null,
          headline: null,
          location: null,
          socialX: null,
          socialInstagram: null,
          socialYoutube: null,
          socialTiktok: null,
          avatar: null,
          avatarStorageKey: null,
          phone: null,
          language: null,
          isSuperAdmin: false,
          lastLoginAt: null,
          signupIp: null,
          signupDeviceId: null,
        },
      });
    });
    return { deletedAt: now };
  }

  findProfileUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: { system: true, menus: { include: { menu: true } } },
            },
          },
        },
      },
    });
  }

  findMenusBySystem(systemId?: string) {
    return this.prisma.menu.findMany({
      where: { systemId },
      orderBy: { sort: 'asc' },
    });
  }

  findPermissionsBySystem(systemId?: string) {
    return this.prisma.permission.findMany({
      where: { menu: { systemId } },
    });
  }

  findLoginUserById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: { include: { system: true } } } } },
    });
  }

  findUserAccount(provider: string, providerAccountId: string) {
    return this.prisma.userAccount.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId } },
      select: { userId: true },
    });
  }

  createUserAccount(input: CreateUserAccountInput) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ status: string }>>`
        SELECT "status" FROM "users" WHERE "id" = ${input.userId} FOR UPDATE
      `;
      if (!rows[0] || rows[0].status === 'DELETED') {
        throw new BadRequestException({ code: 'USER_DELETED', message: '账户不可用' });
      }
      await tx.userAccount.create({
        data: {
          userId: input.userId,
          provider: input.provider,
          providerAccountId: input.providerAccountId,
          accessToken: input.accessToken,
          refreshToken: input.refreshToken,
          idToken: input.idToken,
          expiresAt: input.expiresAt,
          scope: input.scope,
          tokenType: input.tokenType,
          metadata: (input.metadata ?? undefined) as any,
        },
      });
    });
  }

  findUserAccountsByUserId(userId: string) {
    return this.prisma.userAccount.findMany({ where: { userId }, select: { provider: true } });
  }

  async hasOtherCredential(userId: string, excludeProvider: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { password: true } });
    if (user?.password) return true;
    const others = await this.prisma.userAccount.count({ where: { userId, provider: { not: excludeProvider } } });
    return others > 0;
  }

  deleteUserAccount(userId: string, provider: string): Promise<void> {
    return this.prisma.userAccount.deleteMany({ where: { userId, provider } }).then(() => undefined);
  }

  setPendingEmail(userId: string, email: string): Promise<void> {
    return this.prisma.user.updateMany({
      where: { id: userId, status: { not: 'DELETED' } },
      data: { pendingEmail: email },
    }).then((result) => {
      if (result.count !== 1) throw new BadRequestException('账户不可用');
    });
  }

  async setPendingEmailWithProof(input: {
    userId: string;
    sessionId: string;
    proofJti: string;
    email: string;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const consumedProof = await tx.step_up_proofs.updateMany({
        where: {
          jti: input.proofJti,
          userId: input.userId,
          sessionId: input.sessionId,
          purpose: 'STEP_UP_CHANGE_EMAIL',
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { consumedAt: new Date() },
      });
      if (consumedProof.count !== 1) {
        throw new BadRequestException({
          code: 'STEP_UP_INVALID_OR_EXPIRED',
          message: '身份复核凭证无效或已使用',
        });
      }
      const updated = await tx.user.updateMany({
        where: { id: input.userId, status: { not: 'DELETED' } },
        data: { pendingEmail: input.email },
      });
      if (updated.count !== 1) throw new BadRequestException('账户不可用');
    });
  }

  applyVerifiedEmail(userId: string, email: string): Promise<void> {
    return this.prisma.user.updateMany({
      where: { id: userId, pendingEmail: email, status: { not: 'DELETED' } },
      data: { email, emailVerified: true, pendingEmail: null },
    }).then((result) => {
      if (result.count !== 1) throw new BadRequestException('账户不可用');
    });
  }

  createOAuthUser(input: CreateOAuthUserInput) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username: input.username,
          email: input.email,
          password: null,
          status: 'ACTIVE',
          avatar: input.avatar,
          realName: input.realName,
          signupIp: input.signupIp,
          signupDeviceId: input.signupDeviceId,
          emailVerified: input.emailVerified,
        },
      });
      await tx.systemRegistration.create({
        data: { userId: user.id, systemId: input.systemId, status: 'APPROVED', processedAt: new Date(), inviteCode: input.inviteCode },
      });
      const role = await tx.role.findFirst({ where: { systemId: input.systemId, code: input.defaultRoleCode } });
      if (!role) {
        // 与邮箱激活流程（auth.service.ts:210）一致：缺默认角色直接抛错并回滚事务，
        // 避免产出 ACTIVE 但无可访问系统的"孤儿"用户。
        throw new BadRequestException(`该系统未配置默认用户角色(${input.defaultRoleCode})，无法完成账号创建`);
      }
      await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });
      const rawMeta = (input.account.metadata ?? {}) as Record<string, unknown>;
      await tx.userAccount.create({
        data: {
          userId: user.id,
          provider: input.account.provider,
          providerAccountId: input.account.providerAccountId,
          accessToken: input.account.accessToken,
          refreshToken: input.account.refreshToken,
          idToken: input.account.idToken,
          expiresAt: input.account.expiresAt,
          scope: input.account.scope,
          tokenType: input.account.tokenType,
          metadata: { ...rawMeta, emailPlaceholder: input.emailPlaceholder } as any,
        },
      });
      return { id: user.id };
    });
  }
}
