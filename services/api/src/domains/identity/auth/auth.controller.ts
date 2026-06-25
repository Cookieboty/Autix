import { Controller, Post, Body, Req, Get, Put } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import {
  LoginDto,
  RefreshDto,
  RegisterDto,
  ForgotPasswordDto,
  ResetPasswordByTokenDto,
  ActivateAccountDto,
  ResendActivationDto,
} from './dto/login.dto';
import { SwitchSystemDto } from './dto/switch-system.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthUser } from '@autix/domain';
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
    const ip = req.ip || req.socket?.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    return this.authService.login(dto, ip, userAgent);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    // R1-2: 采集注册 IP 与客户端设备指纹（x-device-id），作为风控 sybil 信号源。
    const signupIp = req.ip || req.socket?.remoteAddress || '';
    const deviceHeader = req.headers['x-device-id'];
    const signupDeviceId = Array.isArray(deviceHeader) ? deviceHeader[0] : deviceHeader;
    return this.authService.register(dto, { signupIp, signupDeviceId });
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('refresh')
  async refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordByTokenDto) {
    return this.authService.resetPasswordByToken(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('activate')
  async activate(@Body() dto: ActivateAccountDto) {
    return this.authService.activateAccount(dto);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('resend-activation')
  async resendActivation(@Body() dto: ResendActivationDto) {
    return this.authService.resendActivation(dto.email);
  }

  @Post('logout')
  async logout(@CurrentUser() user: AuthUser) {
    await this.authService.logout(user.sessionId!);
    return { message: '登出成功' };
  }

  @Get('profile')
  async getProfile(@CurrentUser() user: AuthUser, @Req() req: Request & { lang?: string }) {
    const lang = req.lang ?? 'zh-CN';
    return this.authService.getProfile(user, lang);
  }

  @Put('switch-system')
  async switchSystem(@CurrentUser() user: AuthUser, @Body() dto: SwitchSystemDto) {
    return this.authService.switchSystem(user, dto);
  }
}
