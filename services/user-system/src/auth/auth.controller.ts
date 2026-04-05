import { Controller, Post, Body, Req, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthUser } from '@repo/types';
import { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const ip = (req as any).ip || req.socket?.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    return this.authService.login(dto, ip, userAgent);
  }

  @Public()
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
  async getProfile(@CurrentUser() user: AuthUser) {
    return user;
  }
}
