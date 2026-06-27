import { Controller, Get, Post, Delete, Param, Query, Body, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../decorators/public.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { AuthUser } from '@autix/domain';
import { OAuthService } from './oauth.service';
import { OAuthProviderRegistry } from './oauth-provider.registry';
import { AuthorizeQueryDto, CallbackQueryDto, ExchangeDto, LinkBodyDto } from './dto/oauth.dto';

@Controller('auth')
export class OAuthController {
  constructor(
    private readonly oauth: OAuthService,
    private readonly registry: OAuthProviderRegistry,
  ) {}

  @Public()
  @Get('providers')
  async providers() {
    return this.registry.getAvailability();
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get('authorize/:provider')
  authorize(@Param('provider') provider: string, @Query() q: AuthorizeQueryDto) {
    return this.oauth.createAuthorization({ provider, ...q });
  }

  @Public()
  @Get('callback/:provider')
  async callbackGet(
    @Param('provider') provider: string,
    @Query() q: CallbackQueryDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const ip = req.ip || req.socket?.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    const r = await this.oauth.handleCallback({ provider, code: q.code, state: q.state, error: q.error, ip, userAgent });
    // 用 @Res() 直接 302，绕过全局 ResponseInterceptor
    return res.redirect(buildCallbackRedirect(r));
  }

  @Public()
  @Post('callback/:provider')
  async callbackPost(
    @Param('provider') provider: string,
    @Body() body: { code?: string; state: string; user?: string; error?: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const ip = req.ip || req.socket?.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    let extraParams: unknown;
    if (body.user) {
      try { extraParams = { user: JSON.parse(body.user) }; } catch { extraParams = undefined; }
    }
    const r = await this.oauth.handleCallback({ provider, code: body.code, state: body.state, error: body.error, ip, userAgent, extraParams });
    return res.redirect(buildCallbackRedirect(r));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('exchange')
  exchange(@Body() dto: ExchangeDto) {
    return this.oauth.exchangeLoginCode(dto.code);
  }

  @Get('linked-accounts')
  async linkedAccounts(@CurrentUser() user: AuthUser) {
    return { providers: await this.oauth.listLinkedAccounts(user.id) };
  }

  @Post('link/:provider')
  async link(@Param('provider') provider: string, @Body() body: LinkBodyDto, @CurrentUser() user: AuthUser) {
    return this.oauth.createAuthorization({ provider, ...body, linkUserId: user.id });
  }

  @Delete('unlink/:provider')
  async unlink(@Param('provider') provider: string, @CurrentUser() user: AuthUser) {
    await this.oauth.unlink(user.id, provider);
    return { success: true };
  }
}

// 统一的回跳 URL 构造：登录给 code、绑定（Plan 5）给 linked、失败给 error。
// GET 与 Apple POST（Plan 4）回调共用，避免 code=undefined 这类拼接错误。
export function buildCallbackRedirect(r: { redirectUri: string; loginCode?: string; errorCode?: string; linked?: string }): string {
  if (!r.errorCode && !r.linked && !r.loginCode) {
    throw new Error('buildCallbackRedirect: missing loginCode/errorCode/linked');
  }
  const sep = r.redirectUri.includes('?') ? '&' : '?';
  const suffix = r.errorCode
    ? `error=${r.errorCode}`
    : r.linked
      ? `linked=${r.linked}`
      : `code=${r.loginCode}`;
  return `${r.redirectUri}${sep}${suffix}`;
}
