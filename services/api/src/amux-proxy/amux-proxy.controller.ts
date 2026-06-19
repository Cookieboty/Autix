import {
  Controller,
  All,
  Get,
  Post,
  Delete,
  Body,
  Req,
  Res,
  UseGuards,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, getCurrentUserId } from '../auth/decorators/current-user.decorator';
import { AmuxCredentialService } from './amux-credential.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import type { AuthUser } from '@autix/types';

type AmuxProxyRequest = Request<{ path?: string | string[] }>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

@UseGuards(JwtAuthGuard)
@Controller('amux')
export class AmuxProxyController {
  constructor(
    private readonly credentialService: AmuxCredentialService,
    private readonly systemSettingsService: SystemSettingsService,
  ) {}

  private async assertAmuxModelImportEnabled() {
    if (!(await this.systemSettingsService.getBoolean('features.amuxModelImportEnabled'))) {
      throw new ForbiddenException('Amux 模型导入功能已关闭');
    }
  }

  @Get('credential')
  async getCredential(@CurrentUser() user: AuthUser) {
    await this.assertAmuxModelImportEnabled();
    const userId = getCurrentUserId(user);
    return this.credentialService.get(userId);
  }

  @Post('credential')
  async saveCredential(
    @CurrentUser() user: AuthUser,
    @Body() body: { host: string; oat: string; amuxUserId: number },
  ) {
    await this.assertAmuxModelImportEnabled();
    const userId = getCurrentUserId(user);
    if (!body.host || !body.oat || !body.amuxUserId) {
      throw new BadRequestException('Missing required fields');
    }
    await this.credentialService.upsert(userId, body);
    return { success: true };
  }

  @Delete('credential')
  async deleteCredential(@CurrentUser() user: AuthUser) {
    await this.assertAmuxModelImportEnabled();
    const userId = getCurrentUserId(user);
    await this.credentialService.delete(userId);
    return { success: true };
  }

  @All('proxy/*path')
  async proxy(@Req() req: AmuxProxyRequest, @Res() res: Response) {
    await this.assertAmuxModelImportEnabled();
    const amuxHost = (req.headers['x-amux-host'] as string)?.replace(/\/$/, '');
    if (!amuxHost) {
      throw new BadRequestException('Missing X-Amux-Host header');
    }

    const amuxToken = req.headers['x-amux-token'] as string | undefined;
    const amuxUserId = req.headers['x-amux-user-id'] as string | undefined;

    const rawPath = req.params.path || '';
    const subPath = Array.isArray(rawPath) ? rawPath.join('/') : rawPath;
    const qs = new URL(req.url, 'http://localhost').search;
    const targetUrl = `${amuxHost}/api/${subPath}${qs}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (amuxToken) {
      headers['Authorization'] = amuxToken.startsWith('Bearer ')
        ? amuxToken
        : `Bearer ${amuxToken}`;
    }
    if (amuxUserId) {
      headers['New-Api-User'] = amuxUserId;
    }

    const fetchInit: RequestInit = {
      method: req.method,
      headers,
    };
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      fetchInit.body = JSON.stringify(req.body);
    }

    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const upstream = await fetch(targetUrl, fetchInit);

        if (
          (upstream.status === 502 || upstream.status === 503) &&
          attempt < maxAttempts
        ) {
          await new Promise((r) => setTimeout(r, 500 * attempt));
          continue;
        }

        const data = await upstream.arrayBuffer();
        res.status(upstream.status);
        const ct = upstream.headers.get('content-type');
        if (ct) res.setHeader('Content-Type', ct);
        res.send(Buffer.from(data));
        return;
      } catch (err: unknown) {
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 500 * attempt));
          continue;
        }
        res.status(502).json({ success: false, message: errorMessage(err) });
        return;
      }
    }
  }
}
