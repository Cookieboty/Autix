import { Controller, Post, Body, Req, Get, Put } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto, RegisterDto } from './dto/login.dto';
import { SwitchSystemDto } from './dto/switch-system.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthUser } from '@autix/types';
import { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Get('health')
  getHealth() {
    return { status: 'ok' };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const ip = (req as any).ip || req.socket?.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    return this.authService.login(dto, ip, userAgent);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('refresh')
  async refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  async logout(@CurrentUser() user: AuthUser) {
    await this.authService.logout(user.sessionId!);
    return { message: '登出成功' };
  }

  @Get('profile')
  async getProfile(@CurrentUser() user: AuthUser, @Req() req: Request) {
    const lang = (req as any).lang ?? 'zh-CN';
    return this.authService.getProfile(user, lang);
  }

  @Put('switch-system')
  async switchSystem(@CurrentUser() user: AuthUser, @Body() dto: SwitchSystemDto) {
    return this.authService.switchSystem(user, dto);
  }
}
