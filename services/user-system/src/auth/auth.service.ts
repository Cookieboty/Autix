import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload, TokenPair, AuthUser } from '@repo/types';
import { LoginDto, RefreshDto } from './dto/login.dto';
import { SwitchSystemDto } from './dto/switch-system.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
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
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('账户已被禁用');
    }

    const accessibleSystems = user.isSuperAdmin
      ? await this.prisma.system.findMany({ where: { status: 'ACTIVE' } })
      : [...new Map(user.roles.map((ur) => [ur.role.system.id, ur.role.system])).values()];

    const currentSystemId = accessibleSystems[0]?.id;

    const session = await this.prisma.userSession.create({
      data: {
        userId: user.id,
        refreshToken: crypto.randomUUID(),
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
    };

    const accessToken = this.jwtService.sign(payload);
    return {
      accessToken,
      refreshToken: session.refreshToken,
      expiresIn: 86400,
      systems: accessibleSystems.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
      })),
      currentSystemId,
    };
  }

  async refresh(dto: RefreshDto): Promise<TokenPair> {
    const session = await this.prisma.userSession.findUnique({
      where: { refreshToken: dto.refreshToken },
      include: { user: true },
    });
    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('RefreshToken 已过期或无效');
    }

    const newRefreshToken = crypto.randomUUID();
    const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { refreshToken: newRefreshToken, expiresAt: newExpiresAt },
    });

    const payload: JwtPayload = {
      sub: session.user.id,
      username: session.user.username,
      sessionId: session.id,
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

  async getProfile(user: AuthUser): Promise<any> {
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
      systems: accessibleSystems.map((s) => ({ id: s.id, name: s.name, code: s.code })),
      currentSystemId,
      menus: menusInCurrentSystem,
      permissions: permissionsInCurrentSystem,
    };
  }
}
