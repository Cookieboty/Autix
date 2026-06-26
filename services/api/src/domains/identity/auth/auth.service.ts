import { Injectable, UnauthorizedException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { MailService } from '../../platform/mail/mail.service';
import { InviteService } from '../../billing/invite/invite.service';
import { JwtPayload, TokenPair, AuthUser } from '@autix/domain';
import { LANGUAGE_NAME_FIELDS, DEFAULT_LANGUAGE, normalizeLang, type SupportedLanguage } from '@autix/i18n';
import { LoginDto, RefreshDto, RegisterDto, ForgotPasswordDto, ResetPasswordByTokenDto, ActivateAccountDto } from './dto/login.dto';
import { SwitchSystemDto } from './dto/switch-system.dto';
import { AuthIdentityRepository } from './auth-identity.repository';
import { AuthSessionRepository } from './auth-session.repository';
import { AuthTokenFactory } from './auth-token.factory';

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
    private identityRepository: AuthIdentityRepository,
    private sessionRepository: AuthSessionRepository,
    private tokenFactory: AuthTokenFactory,
  ) {}

  async login(dto: LoginDto, ip: string, userAgent: string): Promise<LoginResult> {
    const user = await this.identityRepository.findLoginUserByUsername(dto.username);
    if (!user || !user.password || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    const { loginResult } = await this.issueSessionForUser(user, { ip, userAgent });
    return loginResult; // 响应保持不变，不暴露 sessionId
  }

  async issueSessionForUser(user: SessionUser, ctx: { ip: string; userAgent: string }): Promise<IssuedSession> {
    if (user.status === 'DISABLED' || user.status === 'LOCKED') {
      throw new UnauthorizedException('账户已被禁用');
    }
    const accessibleSystems = user.isSuperAdmin
      ? await this.identityRepository.findActiveSystems()
      : [...new Map(user.roles.map((ur) => [ur.role.system.id, ur.role.system])).values()];
    const currentSystemId = accessibleSystems[0]?.id;
    const refreshToken = this.tokenFactory.createRefreshToken();
    const session = await this.sessionRepository.create({
      userId: user.id, refreshToken, ip: ctx.ip, userAgent: ctx.userAgent,
      expiresAt: this.tokenFactory.createRefreshExpiresAt(), currentSystemId,
    });
    await this.identityRepository.updateLastLoginAt(user.id);
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
        .catch(() => {});

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
      .catch(() => {});

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

    return { message: '激活成功，现在可以登录使用' };
  }

  async refresh(dto: RefreshDto): Promise<TokenPair> {
    const session = await this.sessionRepository.findByRefreshToken(dto.refreshToken);
    if (!session || !session.isActive || session.expiresAt < new Date()) {
      throw new UnauthorizedException('RefreshToken 已过期或无效');
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
    this.mailService.sendPasswordResetEmail(dto.email, token).catch(() => {});
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

    const hashedPassword = await bcrypt.hash(dto.newPassword, 12);
    await this.identityRepository.updatePassword(user.id, hashedPassword);
    await this.sessionRepository.deleteAllForUser(user.id);

    return { message: '密码重置成功' };
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

  async getProfile(user: AuthUser, lang = 'zh-CN') {
    const session = await this.sessionRepository.findById(user.sessionId);

    const userWithSystems = await this.identityRepository.findProfileUser(user.id);

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

    return {
      ...user,
      language: userWithSystems?.language,
      systems: accessibleSystems.map((s) => ({ id: s.id, name: s.name, code: s.code })),
      currentSystemId,
      menus: this.localizeMenus(menusInCurrentSystem, lang),
      permissions: permissionsInCurrentSystem,
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
