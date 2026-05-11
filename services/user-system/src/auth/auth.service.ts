import { Injectable, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { JwtPayload, TokenPair, AuthUser } from '@autix/types';
import { LANGUAGE_NAME_FIELDS, DEFAULT_LANGUAGE, normalizeLang, type SupportedLanguage } from '@autix/i18n';
import { LoginDto, RefreshDto, RegisterDto, ForgotPasswordDto, ResetPasswordByTokenDto } from './dto/login.dto';
import { SwitchSystemDto } from './dto/switch-system.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
  ) {}

  async login(dto: LoginDto, ip: string, userAgent: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
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
    if (!user || !user.password || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    if (user.status === 'DISABLED' || user.status === 'LOCKED') {
      throw new UnauthorizedException('账户已被禁用');
    }

    const accessibleSystems = user.isSuperAdmin
      ? await this.prisma.system.findMany({ where: { status: 'ACTIVE' } })
      : [...new Map(user.roles.map((ur) => [ur.role.system.id, ur.role.system])).values()];

    const currentSystemId = accessibleSystems[0]?.id;

    const session = await this.prisma.userSession.create({
      data: {
        userId: user.id,
        refreshToken: crypto.randomBytes(32).toString('base64url'),
        ip,
        userAgent,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        currentSystemId,
      },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      sessionId: session.id,
      language: user.language ?? undefined,
    };

    const accessToken = this.jwtService.sign(payload);
    return {
      accessToken,
      refreshToken: session.refreshToken,
      expiresIn: 86400,
      status: user.status,
      language: user.language,
      systems: accessibleSystems.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
      })),
      currentSystemId,
    };
  }

  async register(dto: RegisterDto): Promise<{ message: string }> {
    const existingUsername = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (existingUsername) {
      throw new ConflictException('用户名已存在');
    }

    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingEmail) {
      throw new ConflictException('Email 已存在');
    }

    const system = await this.prisma.system.findUnique({
      where: { code: dto.systemCode },
    });
    if (!system) {
      throw new BadRequestException('系统不存在');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username: dto.username,
          email: dto.email,
          password: hashedPassword,
          status: 'PENDING',
        },
      });

      await tx.systemRegistration.create({
        data: {
          userId: user.id,
          systemId: system.id,
          status: 'PENDING',
          inviteCode: dto.inviteCode,
        },
      });
    });

    return { message: '注册成功，等待管理员审批' };
  }

  async refresh(dto: RefreshDto): Promise<TokenPair> {
    const session = await this.prisma.userSession.findUnique({
      where: { refreshToken: dto.refreshToken },
      include: { user: true },
    });
    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('RefreshToken 已过期或无效');
    }

    const newRefreshToken = crypto.randomBytes(32).toString('base64url');
    const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { refreshToken: newRefreshToken, expiresAt: newExpiresAt },
    });

    const payload: JwtPayload = {
      sub: session.user.id,
      username: session.user.username,
      sessionId: session.id,
      language: session.user.language ?? undefined,
    };

    const accessToken = this.jwtService.sign(payload);
    return { accessToken, refreshToken: newRefreshToken, expiresIn: 86400 };
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.userSession.delete({ where: { id: sessionId } });
  }

  async switchSystem(user: AuthUser, dto: SwitchSystemDto): Promise<any> {
    if (!user.isSuperAdmin) {
      const userRole = await this.prisma.userRole.findFirst({
        where: {
          userId: user.id,
          role: { systemId: dto.systemId },
        },
      });
      if (!userRole) {
        throw new BadRequestException('您无权访问该系统');
      }
    }

    await this.prisma.userSession.update({
      where: { id: user.sessionId },
      data: { currentSystemId: dto.systemId },
    });

    return { message: '切换系统成功', currentSystemId: dto.systemId };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const message = '如果邮箱存在，重置邮件已发送';
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, password: true },
    });
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

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.password || user.password.slice(-8) !== payload.ph) {
      throw new BadRequestException('链接已使用或无效');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });
    await this.prisma.userSession.deleteMany({ where: { userId: user.id } });

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

  async getProfile(user: AuthUser, lang = 'zh-CN'): Promise<any> {
    const session = await this.prisma.userSession.findUnique({
      where: { id: user.sessionId },
    });

    const userWithSystems = await this.prisma.user.findUnique({
      where: { id: user.id },
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

    const accessibleSystems = user.isSuperAdmin
      ? await this.prisma.system.findMany({ where: { status: 'ACTIVE' } })
      : [...new Map(userWithSystems!.roles.map((ur) => [ur.role.system.id, ur.role.system])).values()];

    const currentSystemId = session?.currentSystemId || accessibleSystems[0]?.id;

    const menusInCurrentSystem = user.isSuperAdmin
      ? await this.prisma.menu.findMany({
          where: { systemId: currentSystemId },
          orderBy: { sort: 'asc' },
        })
      : userWithSystems!.roles
          .filter((ur) => ur.role.systemId === currentSystemId)
          .flatMap((ur) => ur.role.menus.map((rm) => rm.menu));

    const permissionsInCurrentSystem = user.isSuperAdmin
      ? await this.prisma.permission.findMany({
          where: { menu: { systemId: currentSystemId } },
        })
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
}
