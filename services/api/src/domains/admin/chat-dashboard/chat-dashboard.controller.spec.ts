import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it, vi } from 'vitest';
import { AdminGuard } from '../../identity/auth/admin.guard';
import { PERMISSIONS_KEY } from '../../identity/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../../identity/auth/guards/permissions.guard';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { ChatDashboardController } from './chat-dashboard.controller';
import { ChatDashboardRangeQueryDto } from './dto/chat-dashboard-query.dto';

describe('ChatDashboardController', () => {
  it('keeps the exact five GET routes, guards, and permission metadata', () => {
    expect(Reflect.getMetadata(PATH_METADATA, ChatDashboardController)).toBe('admin/chat-dashboard');
    expect(Reflect.getMetadata(GUARDS_METADATA, ChatDashboardController)).toEqual([JwtAuthGuard, AdminGuard, PermissionsGuard]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, ChatDashboardController)).toEqual(['chat-dashboard:read']);
    const routes = [
      ['pendingInbox', 'pending-inbox'],
      ['generationHealth', 'generation-health'],
      ['billingSummary', 'billing-summary'],
      ['contentPulse', 'content-pulse'],
      ['riskSignals', 'risk-signals'],
    ] as const;
    for (const [method, path] of routes) {
      const handler = ChatDashboardController.prototype[method];
      expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(path);
      expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.GET);
    }
  });

  it('passes pending without query and range DTOs unchanged to the service', async () => {
    const service = { pendingInbox: vi.fn(), generationHealth: vi.fn() };
    const controller = new ChatDashboardController(service as never);
    const user = { id: 'u1', currentSystemId: 'chat-id' } as never;
    const query = { tz: 'UTC', window: 'today' } as const;
    await controller.pendingInbox(user);
    await controller.generationHealth(user, query as ChatDashboardRangeQueryDto);
    expect(service.pendingInbox).toHaveBeenCalledWith(user);
    expect(service.generationHealth).toHaveBeenCalledWith(user, query);
  });

  it('enforces DTO shape, enum, conditional fields, and strips preset from/to', async () => {
    const valid = plainToInstance(ChatDashboardRangeQueryDto, { tz: 'UTC', window: 'custom', from: '2026-06-01', to: '2026-06-15' });
    expect(await validate(valid)).toHaveLength(0);
    const missing = plainToInstance(ChatDashboardRangeQueryDto, { tz: 'UTC', window: 'custom' });
    expect((await validate(missing)).map((error) => error.property).sort()).toEqual(['from', 'to']);
    const invalidWindow = plainToInstance(ChatDashboardRangeQueryDto, { tz: 'UTC', window: 'week' });
    expect((await validate(invalidWindow)).some((error) => error.property === 'window')).toBe(true);
    const preset = plainToInstance(ChatDashboardRangeQueryDto, { tz: 'UTC', window: 'today', from: '2026-01-01', to: '2026-01-02' });
    expect(preset.from).toBeUndefined();
    expect(preset.to).toBeUndefined();
  });
});
