import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload, TokenPair } from '@repo/types';
import { LoginDto, RefreshDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(dto: LoginDto, ip: string, userAgent: string): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({ where: { username: dto.username } });
    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('账户已被禁用');
    }

    const session = await this.prisma.userSession.create({
      data: {
        userId: user.id,
        refreshToken: crypto.randomUUID(),
        ip,
        userAgent,
        deviceName: dto.deviceName,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
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
    return { accessToken, refreshToken: session.refreshToken, expiresIn: 86400 };
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
      data: { refreshToken: newRefreshToken, expiresAt: newExpiresAt, lastActiveAt: new Date() },
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
}
