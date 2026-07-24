import { Controller, Post, Body, Req, Get, Put, Delete, Patch } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { EmailChangeService } from './email-change.service';
import { AccountDeletionService } from './account-deletion.service';
import {
  LoginDto,
  RefreshDto,
  RegisterDto,
  ForgotPasswordDto,
  ResetPasswordByTokenDto,
  ActivateAccountDto,
  ResendActivationDto,
  RequestEmailSupplementDto,
  RequestEmailChangeDto,
  ConfirmEmailChangeDto,
  SetOrChangePasswordDto,
  DeleteAccountDto,
} from './dto/login.dto';
import { SwitchSystemDto } from './dto/switch-system.dto';
import { UpdateOwnProfileDto } from './dto/update-own-profile.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthUser, StartStepUpResult } from '@autix/domain';
import type { Request } from 'express';
import { DEFAULT_LANGUAGE } from '@autix/i18n';
import { StepUpService } from './step-up/step-up.service';
import { OAuthService } from './oauth/oauth.service';
import {
  StepUpAuthorizeDto,
  StepUpOtpRequestDto,
  StepUpOtpVerifyDto,
} from './step-up/step-up.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private emailChangeService: EmailChangeService,
    private stepUpService: StepUpService,
    private oauthService: OAuthService,
    private accountDeletionService: AccountDeletionService,
  ) { }

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
    return { messageKey: 'auth.logout.success' };
  }

  @Get('profile')
  async getProfile(@CurrentUser() user: AuthUser, @Req() req: Request & { lang?: string }) {
    const lang = req.lang ?? DEFAULT_LANGUAGE;
    return this.authService.getProfile(user, lang);
  }

  /**
   * T11: 自助更新 profile（白名单三字段：nickname / description / avatar）。
   *
   * 返回值格式与 `GET auth/profile` 一致（AuthProfile），前端可以直接 `setUser(response)` 原子刷新。
   * 限流较严：60s 内最多 10 次，防止批量刷 nickname 制造骚扰。
   */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Patch('profile')
  async updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateOwnProfileDto,
    @Req() req: Request & { lang?: string },
  ) {
    const lang = req.lang ?? DEFAULT_LANGUAGE;
    return this.authService.updateOwnProfile(user, dto, lang);
  }

  @Put('switch-system')
  async switchSystem(@CurrentUser() user: AuthUser, @Body() dto: SwitchSystemDto) {
    return this.authService.switchSystem(user, dto);
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('email')
  async requestEmailSupplement(@CurrentUser() user: AuthUser, @Body() dto: RequestEmailSupplementDto) {
    await this.emailChangeService.requestSupplement(user.id, dto.email);
    return { messageKey: 'auth.email.verification_sent' };
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('email/change')
  async requestEmailChange(
    @CurrentUser() user: AuthUser,
    @Body() dto: RequestEmailChangeDto,
    @Req() req: Request & { lang?: string },
  ) {
    await this.emailChangeService.requestChange(user.id, dto.email, dto.proof, user.sessionId);
    return this.authService.getProfile(user, req.lang ?? DEFAULT_LANGUAGE);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('email/confirm')
  async confirmEmail(@Body() dto: ConfirmEmailChangeDto) {
    await this.emailChangeService.confirm(dto.token);
    return { messageKey: 'auth.email.verified' };
  }

  /**
   * step-up 授权（密码分支 / OAuth 分支占位）。
   * - 提交 password → 返回 { kind: 'redirect' | 'otp' | 'unsupported' } 之外的 { proof, expiresAt }
   *   为保持 tagged union 的对外契约，password 分支直接返回 { kind:'password', proof, expiresAt }
   *   注：domain 里 StartStepUpResult 只覆盖 redirect/otp/unsupported，password 分支在业务侧走 200 直发 proof
   */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('step-up/authorize')
  async stepUpAuthorize(
    @CurrentUser() user: AuthUser,
    @Body() dto: StepUpAuthorizeDto,
    @Req() req: Request,
  ): Promise<
    | { kind: 'password'; proof: string; expiresAt: string }
    | StartStepUpResult
  > {
    if (dto.password) {
      const result = await this.stepUpService.authorizeByPassword(
        user.id,
        dto.purpose,
        dto.password,
        user.sessionId,
      );
      return { kind: 'password', ...result };
    }
    await this.stepUpService.assertPasswordlessUser(user.id);
    if (!dto.preferEmailOtp && user.sessionId && dto.clientType && dto.redirectUri) {
      const redirect = await this.oauthService.startReauth({
        userId: user.id,
        sessionId: user.sessionId,
        purpose: dto.purpose,
        clientType: dto.clientType,
        redirectUri: dto.redirectUri,
        provider: dto.provider,
      });
      if (redirect) return redirect;
    }
    return this.stepUpService.requestOtp(user.id, dto.purpose, user.sessionId, req.ip);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('step-up/otp/request')
  async stepUpOtpRequest(
    @CurrentUser() user: AuthUser,
    @Body() dto: StepUpOtpRequestDto,
    @Req() req: Request,
  ): Promise<StartStepUpResult> {
    return this.stepUpService.requestOtp(user.id, dto.purpose, user.sessionId, req.ip);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('step-up/otp/verify')
  async stepUpOtpVerify(
    @CurrentUser() user: AuthUser,
    @Body() dto: StepUpOtpVerifyDto,
    @Req() req: Request,
  ): Promise<{ proof: string; expiresAt: string }> {
    return this.stepUpService.verifyOtp(user.id, dto.purpose, dto.requestId, dto.code, user.sessionId, req.ip);
  }

  /**
   * 已登录用户设置/修改密码：消费 step-up proof + 更新密码 + 吊销其他会话。
   */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password')
  async setOrChangePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: SetOrChangePasswordDto,
  ) {
    return this.authService.setOrChangePassword(user, dto.proof, dto.newPassword);
  }

  /** 消费一次性 step-up proof，并在单事务内立即匿名化账户。 */
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Delete('account')
  async deleteAccount(
    @CurrentUser() user: AuthUser,
    @Body() dto: DeleteAccountDto,
  ) {
    const { deletedAt } = await this.accountDeletionService.deleteImmediately(
      user.id,
      dto.proof,
      user.sessionId,
      dto.usernameConfirmation,
    );
    return {
      messageKey: 'auth.account.deleted',
      deletedAt: deletedAt.toISOString(),
    };
  }
}
