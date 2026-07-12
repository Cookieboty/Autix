import { Injectable, UnauthorizedException, BadRequestException, ConflictException, ForbiddenException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { MailService } from '../../platform/mail/mail.service';
import { CloudflareR2Service } from '../../platform/storage/cloudflare-r2.service';
import { StorageCleanupService } from '../../platform/storage/storage-cleanup.service';
import { AvatarImageProcessor } from '../../platform/storage/avatar-image-processor.service';
import { InviteService } from '../../billing/invite/invite.service';
import { CampaignRewardService } from '../../billing/campaign/campaign-reward.service';
import { JwtPayload, TokenPair, AuthUser } from '@autix/domain';
import { LANGUAGE_NAME_FIELDS, DEFAULT_LANGUAGE, normalizeLang, type SupportedLanguage } from '@autix/i18n';
import { LoginDto, RefreshDto, RegisterDto, ForgotPasswordDto, ResetPasswordByTokenDto, ActivateAccountDto } from './dto/login.dto';
import { SwitchSystemDto } from './dto/switch-system.dto';
import { AuthIdentityRepository } from './auth-identity.repository';
import { AuthSessionRepository } from './auth-session.repository';
import { AuthTokenFactory } from './auth-token.factory';
import { StepUpService } from './step-up/step-up.service';
import type { StepUpPurpose } from '@autix/domain';

type SessionUser = Awaited<ReturnType<AuthIdentityRepository['findLoginUserByUsername']>> extends infer T
  ? NonNullable<T>
  : never;

export type LoginResult = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  status: string;
  language: string | null;
  systems: { id: string; name: string; code: string }[];
  currentSystemId?: string;
};

// issueSessionForUser 的内部返回：loginResult 给前端，sessionId 仅供 OAuth 内部绑定一次性码
export type IssuedSession = { loginResult: LoginResult; sessionId: string };

type SwitchSystemResult = {
  message: string;
  currentSystemId: string;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private jwtService: JwtService,
    private mailService: MailService,
    private inviteService: InviteService,
    private campaignRewardService: CampaignRewardService,
    private identityRepository: AuthIdentityRepository,
    private sessionRepository: AuthSessionRepository,
    private tokenFactory: AuthTokenFactory,
    private stepUpService: StepUpService,
    private readonly r2: CloudflareR2Service,
    private readonly storageCleanup: StorageCleanupService,
    private readonly avatarImageProcessor: AvatarImageProcessor,
  ) { }

  async login(dto: LoginDto, ip: string, userAgent: string): Promise<LoginResult> {
    const user = await this.identityRepository.findLoginUserByUsername(dto.username);
    if (!user || !user.password || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    const { loginResult } = await this.issueSessionForUser(user, { ip, userAgent });
    return loginResult; // 响应保持不变，不暴露 sessionId
  }

  private async computeAccessibleSystems(user: SessionUser) {
    return user.isSuperAdmin
      ? await this.identityRepository.findActiveSystems()
      : [...new Map(user.roles.map((ur) => [ur.role.system.id, ur.role.system])).values()];
  }

  async buildLoginResultFromSession(sessionId: string): Promise<LoginResult> {
    const session = await this.sessionRepository.findById(sessionId);
    // 与 JwtStrategy.validate / refresh 同等守卫：会话必须有效，用户必须可用
    if (!session || !session.isActive || session.expiresAt < new Date()) {
      throw new UnauthorizedException('会话已失效');
    }
    const user = await this.identityRepository.findLoginUserById(session.userId);
    if (!user || user.status === 'DISABLED' || user.status === 'LOCKED') {
      throw new UnauthorizedException('账户不可用');
    }
    // DELETED 用户即使仍有异常残留 session 也不能继续使用。
    if (user.status === 'DELETED') {
      throw new UnauthorizedException('账户不可用');
    }
    const accessibleSystems = await this.computeAccessibleSystems(user);
    const payload: JwtPayload = {
      sub: user.id, username: user.username, sessionId: session.id, language: user.language ?? undefined,
    };
    const tokenPair = this.tokenFactory.createTokenPair(payload, session.refreshToken);
    return {
      ...tokenPair, status: user.status, language: user.language,
      systems: accessibleSystems.map((s) => ({ id: s.id, name: s.name, code: s.code })),
      currentSystemId: session.currentSystemId ?? accessibleSystems[0]?.id,
    };
  }

  async issueSessionForUser(user: SessionUser, ctx: { ip: string; userAgent: string }): Promise<IssuedSession> {
    if (user.status === 'DISABLED' || user.status === 'LOCKED') {
      throw new UnauthorizedException('账户已被禁用');
    }
    if ((user as { status: string }).status === 'DELETED') {
      throw new UnauthorizedException('账户不可用');
    }
    const accessibleSystems = await this.computeAccessibleSystems(user);
    const currentSystemId = accessibleSystems[0]?.id;
    const refreshToken = this.tokenFactory.createRefreshToken();
    const session = await this.sessionRepository.create({
      userId: user.id, refreshToken, ip: ctx.ip, userAgent: ctx.userAgent,
      expiresAt: this.tokenFactory.createRefreshExpiresAt(), currentSystemId,
    });
    const payload: JwtPayload = {
      sub: user.id, username: user.username, sessionId: session.id,
      language: user.language ?? undefined,
    };
    const tokenPair = this.tokenFactory.createTokenPair(payload, session.refreshToken);
    const loginResult: LoginResult = {
      ...tokenPair,
      status: user.status,
      language: user.language,
      systems: accessibleSystems.map((s) => ({ id: s.id, name: s.name, code: s.code })),
      currentSystemId,
    };
    return { loginResult, sessionId: session.id };
  }

  async register(
    dto: RegisterDto,
    context: { signupIp?: string; signupDeviceId?: string } = {},
  ): Promise<{ message: string; requiresActivation: boolean }> {
    const existingUsername = await this.identityRepository.findUserByUsername(dto.username);
    if (existingUsername) {
      throw new ConflictException('用户名已存在');
    }

    const existingEmail = await this.identityRepository.findUserByEmail(dto.email);
    if (existingEmail) {
      throw new ConflictException('Email 已存在');
    }

    const system = await this.identityRepository.findSystemByCode(dto.systemCode);
    if (!system) {
      throw new BadRequestException('系统不存在');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    if (system.autoApprove) {
      const user = await this.identityRepository.createRegistration({
        username: dto.username,
        email: dto.email,
        password: hashedPassword,
        systemId: system.id,
        registrationStatus: 'PENDING_ACTIVATION',
        inviteCode: dto.inviteCode,
        signupIp: context.signupIp,
        signupDeviceId: context.signupDeviceId,
      });

      await this.recordInvitationIfPresent(dto.inviteCode, user.id);

      const token = this.jwtService.sign(
        {
          sub: user.id,
          purpose: 'email-activation',
          systemId: system.id,
          inviteCode: dto.inviteCode,
        },
        { expiresIn: '1h' },
      );
      this.mailService
        .sendActivationEmail(user.email, user.username, token)
        .catch(() => { });

      return { message: '注册成功，请前往邮箱点击激活链接以完成账户激活', requiresActivation: true };
    }

    const user = await this.identityRepository.createRegistration({
      username: dto.username,
      email: dto.email,
      password: hashedPassword,
      systemId: system.id,
      registrationStatus: 'PENDING',
      inviteCode: dto.inviteCode,
      signupIp: context.signupIp,
      signupDeviceId: context.signupDeviceId,
    });

    await this.recordInvitationIfPresent(dto.inviteCode, user.id);

    return { message: '注册成功，等待管理员审批', requiresActivation: false };
  }

  async resendActivation(email: string): Promise<{ message: string }> {
    const user = await this.identityRepository.findUserByEmail(email);
    if (!user || user.status !== 'PENDING') {
      return { message: '如果该邮箱对应待激活账户，激活邮件已重新发送' };
    }

    const reg = await this.identityRepository.findPendingActivationRegistration(user.id);
    if (!reg || !reg.system.autoApprove) {
      return { message: '如果该邮箱对应待激活账户，激活邮件已重新发送' };
    }

    const token = this.jwtService.sign(
      {
        sub: user.id,
        purpose: 'email-activation',
        systemId: reg.systemId,
        inviteCode: reg.inviteCode ?? undefined,
      },
      { expiresIn: '1h' },
    );
    this.mailService
      .sendActivationEmail(user.email, user.username, token)
      .catch(() => { });

    return { message: '如果该邮箱对应待激活账户，激活邮件已重新发送' };
  }

  async activateAccount(dto: ActivateAccountDto): Promise<{ message: string }> {
    let payload: { sub: string; purpose: string; systemId: string; inviteCode?: string };
    try {
      payload = this.jwtService.verify(dto.token);
    } catch {
      throw new BadRequestException('激活链接已过期或无效');
    }
    if (payload.purpose !== 'email-activation') {
      throw new BadRequestException('无效的激活链接');
    }

    const user = await this.identityRepository.findUserById(payload.sub);
    if (!user) {
      throw new BadRequestException('用户不存在');
    }
    if (user.status !== 'PENDING') {
      throw new BadRequestException('账户已激活或状态异常，无需重复激活');
    }

    const system = await this.identityRepository.findSystemById(payload.systemId);
    if (!system) {
      throw new BadRequestException('系统不存在');
    }
    if (!system.autoApprove) {
      throw new BadRequestException('无效的激活链接');
    }

    const registration = await this.identityRepository.findRegistrationByUserAndSystem(
      user.id,
      system.id,
    );
    if (!registration || registration.status !== 'PENDING_ACTIVATION') {
      throw new BadRequestException('账户已激活或状态异常，无需重复激活');
    }

    const userRole = await this.identityRepository.findRoleBySystemAndCode(system.id, 'USER');
    if (!userRole) {
      throw new BadRequestException('该系统未配置默认用户角色(USER)，无法完成激活');
    }

    await this.identityRepository.activateRegistration({
      userId: user.id,
      registrationId: registration.id,
      roleId: userRole.id,
      inviteCode: payload.inviteCode,
    });

    // FIX-2: 邮箱激活成功后结算邀请奖励（best-effort，失败不影响激活）。
    await this.settleInvitationReward(user.id);
    await this.grantRegistrationBonus(user.id, 'email_activation');

    return { message: '激活成功，现在可以登录使用' };
  }

  async refresh(dto: RefreshDto): Promise<TokenPair> {
    const session = await this.sessionRepository.findByRefreshToken(dto.refreshToken);
    if (!session || !session.isActive || session.expiresAt < new Date()) {
      throw new UnauthorizedException('RefreshToken 已过期或无效');
    }
    if (
      session.user.status === 'DELETED' ||
      session.user.status === 'DISABLED' ||
      session.user.status === 'LOCKED'
    ) {
      throw new UnauthorizedException('账户不可用');
    }

    const newRefreshToken = this.tokenFactory.createRefreshToken();
    await this.sessionRepository.rotateRefreshToken({
      sessionId: session.id,
      refreshToken: newRefreshToken,
      expiresAt: this.tokenFactory.createRefreshExpiresAt(),
    });

    const payload: JwtPayload = {
      sub: session.user.id,
      username: session.user.username,
      sessionId: session.id,
      language: session.user.language ?? undefined,
    };

    return this.tokenFactory.createTokenPair(payload, newRefreshToken);
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessionRepository.delete(sessionId);
  }

  async switchSystem(user: AuthUser, dto: SwitchSystemDto): Promise<SwitchSystemResult> {
    if (!user.isSuperAdmin) {
      const userRole = await this.identityRepository.findUserRoleInSystem(
        user.id,
        dto.systemId,
      );
      if (!userRole) {
        throw new BadRequestException('您无权访问该系统');
      }
    }

    await this.sessionRepository.updateCurrentSystem(user.sessionId, dto.systemId);

    return { message: '切换系统成功', currentSystemId: dto.systemId };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const message = '如果邮箱存在，重置邮件已发送';
    const user = await this.identityRepository.findPasswordResetUserByEmail(dto.email);
    if (!user || !user.password) return { message };

    const token = this.jwtService.sign(
      { sub: user.id, purpose: 'password-reset', ph: user.password.slice(-8) },
      { expiresIn: '5m' },
    );
    this.mailService.sendPasswordResetEmail(dto.email, token).catch(() => { });
    return { message };
  }

  async resetPasswordByToken(dto: ResetPasswordByTokenDto): Promise<{ message: string }> {
    let payload: { sub: string; purpose: string; ph: string };
    try {
      payload = this.jwtService.verify(dto.token);
    } catch {
      throw new BadRequestException('链接已过期或无效');
    }
    if (payload.purpose !== 'password-reset') {
      throw new BadRequestException('无效的重置链接');
    }

    const user = await this.identityRepository.findUserById(payload.sub);
    if (!user || !user.password || user.password.slice(-8) !== payload.ph) {
      throw new BadRequestException('链接已使用或无效');
    }
    // T3: 补 status 条件，DELETED / DISABLED / LOCKED 账户不允许重置密码
    if (user.status === 'DELETED' || user.status === 'DISABLED' || user.status === 'LOCKED') {
      throw new BadRequestException('账户不可用');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 12);
    await this.identityRepository.resetPasswordAndRevokeSessions({
      userId: user.id,
      password: hashedPassword,
      expectedPasswordSuffix: payload.ph,
    });

    return { message: '密码重置成功' };
  }

  /**
   * 已登录用户设置或修改密码。
   * - 修改密码（用户已有密码）：purpose='change-password'，proof 必须来自 password 或 otp 分支
   * - 首次设置密码（OAuth-only 用户）：purpose='set-password'，proof 必须来自 otp/oauth 分支
   * 成功后销毁除当前会话外的所有会话（安全 hygiene）。
   */
  async setOrChangePassword(
    user: AuthUser,
    proof: string,
    newPassword: string,
    lang: string = DEFAULT_LANGUAGE,
  ) {
    const dbUser = await this.identityRepository.findUserById(user.id);
    // 安全：账户态失败用 409（业务冲突）而非 401——step-up 端点返回 401 会触发 SDK 自动 refresh+重试，
    // refresh 通常仍合法 → 重试再 401 → SDK 清 token 强制登出（脚枪）。这里用 USER_NOT_AVAILABLE/409。
    if (!dbUser) {
      throw new ConflictException({ code: 'USER_NOT_AVAILABLE', message: '账户不可用' });
    }
    if (dbUser.status === 'DELETED' || dbUser.status === 'DISABLED' || dbUser.status === 'LOCKED') {
      throw new ConflictException({ code: 'USER_NOT_AVAILABLE', message: '账户不可用' });
    }

    const purpose: StepUpPurpose = dbUser.password ? 'change-password' : 'set-password';
    const proofPayload = this.stepUpService.verifyProof(proof, user.id, purpose, user.sessionId);

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    // T12: 密码落库 + 非当前会话吊销 + status 锁必须同事务（spec §3.2 B）
    await this.identityRepository.changePasswordAndRevokeOtherSessions({
      userId: user.id,
      password: hashedPassword,
      keepSessionId: user.sessionId!,
      proofJti: proofPayload.jti,
      proofPurpose: purpose === 'change-password'
        ? 'STEP_UP_CHANGE_PASSWORD'
        : 'STEP_UP_SET_PASSWORD',
    });

    return this.buildAuthProfile({ user, lang });
  }

  private localizeMenus(menus: any[], lang: string): any[] {
    const normalized = (normalizeLang(lang) ?? DEFAULT_LANGUAGE) as SupportedLanguage;
    const field = LANGUAGE_NAME_FIELDS[normalized];
    if (!field || field === 'name') return menus;
    return menus.map((m) => ({
      ...m,
      name: m[field] || m.name,
    }));
  }

  async getProfile(user: AuthUser, lang: string = DEFAULT_LANGUAGE) {
    return this.buildAuthProfile({ user, lang });
  }

  /**
   * T11: 自助更新 profile（`PATCH auth/profile`）。
   *
   * 事务边界很小 —— 只写一次 user.update；调用完毕后直接调用 `buildAuthProfile` 重建响应，
   * 因为 `buildAuthProfile` 内部会重读 DB，天然保证前端拿到的是最新值（避免 spec §3.3 P2
   * 描述的"改完后展开 JWT 快照导致回退"的陷阱）。
   *
   * status 校验（`DELETED / DISABLED / LOCKED`）由 repository 的 `where.status != DELETED`
   * + 显式前置检查共同完成 —— DISABLED/LOCKED 用户理论上无法登录到这一步，但 status 可能
   * 在 session 存活期间被 admin 变更，仍需服务端兜底。
   */
  async updateOwnProfile(
    user: AuthUser,
    input: { nickname?: string | null; description?: string | null; avatar?: string | null; avatarStorageKey?: string },
    lang: string = DEFAULT_LANGUAGE,
  ) {
    const dbUser = await this.identityRepository.findUserById(user.id);
    if (!dbUser) {
      throw new UnauthorizedException('账户不可用');
    }
    if (dbUser.status === 'DELETED' || dbUser.status === 'DISABLED' || dbUser.status === 'LOCKED') {
      throw new UnauthorizedException('账户不可用');
    }

    // T16: 分派两条头像路径
    // 1) 外链 avatar（旧路径）：走 identityRepository.updateOwnProfile —— 该 helper 会同步清空 avatarStorageKey
    //    dbUser.avatarStorageKey 若非空，在同一事务写入 AVATAR_REPLACED outbox
    // 2) avatarStorageKey（reservation 路径）：走 consumeAvatarReservation 事务原子消费；
    //    消费 reservation 与头像清理 outbox 在同一事务完成
    // 3) 其余字段（nickname/description）在两条路径外单独 update
    const { avatarStorageKey, avatar: _avatarField, ...restNonAvatar } = input;
    const hasAvatarField = Object.prototype.hasOwnProperty.call(input, 'avatar');
    const hasAvatarKey = typeof avatarStorageKey === 'string' && avatarStorageKey.length > 0;
    // DTO 已校验互斥，这里 defence-in-depth 再兜一次
    if (hasAvatarField && hasAvatarKey) {
      throw new BadRequestException('avatar 与 avatarStorageKey 不能同时提交');
    }

    // 先写非头像字段（若存在），保持事务粒度最小
    if (
      Object.prototype.hasOwnProperty.call(restNonAvatar, 'nickname') ||
      Object.prototype.hasOwnProperty.call(restNonAvatar, 'description') ||
      hasAvatarField
    ) {
      // 若同时提供了外链 avatar，与 nickname/description 一起原子写；identityRepository.updateOwnProfile 内部已按白名单
      const payload: { nickname?: string | null; description?: string | null; avatar?: string | null } = {};
      if (Object.prototype.hasOwnProperty.call(restNonAvatar, 'nickname')) payload.nickname = restNonAvatar.nickname;
      if (Object.prototype.hasOwnProperty.call(restNonAvatar, 'description')) payload.description = restNonAvatar.description;
      if (hasAvatarField) payload.avatar = _avatarField ?? null;
      await this.identityRepository.updateOwnProfile(user.id, payload);
    }

    // 再消费 reservation（若提供了 avatarStorageKey）
    if (hasAvatarKey) {
      // T18: server-side 图像预处理 —— 下载原图 → resize 512×512 + strip metadata + WebP →
      // 上传到新 key。降级路径由 processor 自己收敛（processed=false 时 storageKey=原 key）。
      const reservation = await this.identityRepository.assertPendingAvatarReservation(user.id, avatarStorageKey!);
      const object = await this.r2.getObjectMetadata(avatarStorageKey!);
      const expectedContentType = reservation.contentType?.split(';')[0]?.trim().toLowerCase() ?? null;
      const actualContentType = object.contentType?.split(';')[0]?.trim().toLowerCase() ?? null;
      if (
        !object.exists ||
        (reservation.sizeBytes !== null && object.contentLength !== reservation.sizeBytes) ||
        (expectedContentType !== null && actualContentType !== expectedContentType)
      ) {
        throw new BadRequestException('头像对象不存在或与上传凭据不匹配');
      }
      const processed = await this.avatarImageProcessor.processAndUpload(user.id, avatarStorageKey!);

      try {
        await this.identityRepository.consumeAvatarReservation(
          user.id,
          avatarStorageKey!,
          processed.publicUrl,
          processed.storageKey,
        );
      } catch (error) {
        // 预处理已生成派生对象，但 reservation 可能在最终消费前并发失效。
        // 原图仍由 reservation 生命周期管理，仅清理这次未被引用的派生对象。
        if (processed.processed && processed.storageKey !== avatarStorageKey) {
          await this.storageCleanup.enqueue({
            storageKey: processed.storageKey,
            ownerUserId: user.id,
            reason: 'AVATAR_REPLACED',
          });
        }
        throw error;
      }
    }

    // 重建 AuthProfile —— buildAuthProfile 内部会重读 DB 保证 nickname/avatar/description 立即刷新
    return this.buildAuthProfile({ user, lang });
  }

  /**
   * T15: 用户 profile 端点统一 helper。
   *
   * 使用场景（返回完整 `AuthProfile`）：
   * - `GET auth/profile`
   * - `PATCH users/me/profile`（保存后原子刷新 auth store）
   * - `POST auth/password`（改密后原子刷新）
   *
   * **不用于** `login` / `refresh` 的 token 响应，那里仍走精简 payload。
   *
   * 关键约束（spec §3.3 [P2 修复]）：
   * 1. **必须先重读数据库**，把 `nickname / avatar / description / avatarStorageKey / emailVerified /
   *    language / pendingEmail / password` 从 DB 覆盖到 JWT 快照上——`user` 是请求开始时 JWT strategy
   *    读到的旧值，`PATCH users/me/profile` 事务提交后如果直接展开 `user`，前端 store 会立刻回退。
   * 2. **`avatarStorageKey` 是服务端内部字段**，返回时必须显式剥离，不进入 domain `AuthProfile` 类型。
   * 3. 未覆盖字段（`sessionId / permissions / roles / isSuperAdmin`）沿用 `user`。
   */
  async buildAuthProfile({
    user,
    lang = DEFAULT_LANGUAGE,
  }: {
    user: AuthUser;
    lang?: string;
  }) {
    const session = await this.sessionRepository.findById(user.sessionId);
    const userWithSystems = await this.identityRepository.findProfileUser(user.id);
    if (!userWithSystems || userWithSystems.status === 'DELETED') {
      throw new UnauthorizedException('账户不可用');
    }

    const accessibleSystems = user.isSuperAdmin
      ? await this.identityRepository.findActiveSystems()
      : [...new Map(userWithSystems!.roles.map((ur) => [ur.role.system.id, ur.role.system])).values()];

    const currentSystemId = session?.currentSystemId || accessibleSystems[0]?.id;

    const menusInCurrentSystem = user.isSuperAdmin
      ? await this.identityRepository.findMenusBySystem(currentSystemId)
      : userWithSystems!.roles
        .filter((ur) => ur.role.systemId === currentSystemId)
        .flatMap((ur) => ur.role.menus.map((rm) => rm.menu));

    const permissionsInCurrentSystem = user.isSuperAdmin
      ? await this.identityRepository.findPermissionsBySystem(currentSystemId)
      : user.permissions;

    // 重读 DB 覆盖旧 AuthUser 字段；`avatarStorageKey` 只用于服务端判断（如头像清理），不返回给前端
    const fresh = userWithSystems;
    // 显式剥离：即便未来 JWT payload 扩展带上 avatarStorageKey，此处也不会泄漏
    const { avatarStorageKey: _internalAvatarKey, ...safeUser } = user as AuthUser & {
      avatarStorageKey?: string | null;
    };
    void _internalAvatarKey;

    return {
      ...safeUser,
      // ---- DB 覆盖字段（保证 PATCH/POST 后前端立即拿到新值） ----
      username: fresh.username,
      email: fresh.email,
      status: fresh.status,
      nickname: fresh.nickname,
      avatar: fresh.avatar,
      description: fresh.description,
      realName: fresh.realName,
      language: fresh.language,
      emailVerified: fresh.emailVerified,
      pendingEmail: fresh.pendingEmail,
      hasPassword: Boolean(fresh.password),
      // ---- 组装项 ----
      systems: accessibleSystems.map((s) => ({ id: s.id, name: s.name, code: s.code })),
      currentSystemId,
      menus: this.localizeMenus(menusInCurrentSystem, lang),
      permissions: permissionsInCurrentSystem,
      features: {
        nicknameEditable: true,
        descriptionEditable: true,
        emailChange: true,
        passwordSet: true,
        accountDeletion: true,
      },
      // NOTE: 显式**不返回** avatarStorageKey；domain `AuthProfile` 类型也已剔除该字段。
    };
  }

  private async settleInvitationReward(userId: string) {
    try {
      await this.inviteService.settlePendingInvitationReward(userId);
    } catch (err) {
      this.logger.error(
        'Failed to settle invitation reward',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  private async grantRegistrationBonus(userId: string, source: 'email_activation' | 'oauth_first_login') {
    try {
      await this.campaignRewardService.grantRegistrationBonus(userId, source);
    } catch (err) {
      this.logger.error(
        'Failed to grant registration bonus',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  private async recordInvitationIfPresent(inviteCode: string | undefined, userId: string) {
    if (!inviteCode) return;
    try {
      await this.inviteService.recordInvitation(inviteCode, userId);
    } catch (err) {
      this.logger.error(
        'Failed to record invitation',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
