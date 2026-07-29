import type { AddressInfo } from 'node:net';
import type {
  ChatDashboardBillingSummary,
  ChatDashboardGenerationHealth,
  ChatDashboardPendingInbox,
  ChatDashboardRiskSignals,
} from '@autix/domain/admin/chat-dashboard';
import {
  HttpStatus,
  INestApplication,
  Module,
  ValidationPipe,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import type { ValidationError } from 'class-validator';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminGuard } from '../../identity/auth/admin.guard';
import { PERMISSIONS_KEY } from '../../identity/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../../identity/auth/guards/permissions.guard';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { AllExceptionsFilter } from '../../platform/common/all-exceptions.filter';
import { ResponseInterceptor } from '../../platform/common/response.interceptor';
import { flattenValidationErrors } from '../../platform/common/validation-violations';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';
import type { I18nService } from '../../platform/i18n/i18n.service';
import { ChatDashboardController } from './chat-dashboard.controller';
import { ChatDashboardRepository } from './chat-dashboard.repository';
import { ChatDashboardService } from './chat-dashboard.service';

const guardState = vi.hoisted(() => ({
  currentUser: { id: 'admin-1', currentSystemId: 'chat-id' } as Record<string, unknown>,
}));

vi.mock('../../identity/auth/jwt-auth.guard', () => ({
  JwtAuthGuard: class {
    canActivate(context: { switchToHttp(): { getRequest(): Record<string, unknown> } }) {
      context.switchToHttp().getRequest().user = guardState.currentUser;
      return true;
    }
  },
}));
vi.mock('../../identity/auth/admin.guard', () => ({ AdminGuard: class { canActivate() { return true; } } }));
vi.mock('../../identity/auth/guards/permissions.guard', () => ({ PermissionsGuard: class { canActivate() { return true; } } }));

const repo = {
  findSystemCodeById: vi.fn().mockResolvedValue('chat'),
  countGalleryPending: vi.fn().mockResolvedValue(1),
  countGalleryPendingReports: vi.fn().mockResolvedValue(2),
  countTemplatePending: vi.fn().mockResolvedValue({ image: 3, video: 4 }),
  countRegistrationPending: vi.fn().mockResolvedValue(5),
  countFlaggedRiskUsers: vi.fn().mockResolvedValue(6),
  countBatchJobsProcessing: vi.fn().mockResolvedValue(7),
  groupGenerationByStatus: vi.fn().mockResolvedValue([]),
  aggregateGenerationDuration: vi.fn().mockResolvedValue({ avgMs: null }),
  groupGenerationFailureReasons: vi.fn().mockResolvedValue([]),
  groupGenerationTopModels: vi.fn().mockResolvedValue([]),
  sumGmvByCurrency: vi.fn().mockResolvedValue([{ currency: 'USD', amount: '12.50' }]),
  countPaidOrders: vi.fn().mockResolvedValue(0),
  sumRefundedByCurrency: vi.fn().mockResolvedValue([{ currency: 'USD', amount: '2.50' }]),
  sumPointsConsumed: vi.fn().mockResolvedValue(0),
  groupTopPointsConsumers: vi.fn().mockResolvedValue([]),
  countPendingOrdersGlobal: vi.fn().mockResolvedValue(0),
  countActiveHoldsGlobal: vi.fn().mockResolvedValue(0),
  findUsersForDisplay: vi.fn().mockResolvedValue([]),
  countGalleryPublished: vi.fn().mockResolvedValue({ image: 0, video: 0 }),
  countConversationsCreated: vi.fn().mockResolvedValue(0),
  topGalleryHot: vi.fn().mockResolvedValue([]),
  featuredSlotsCoverage: vi.fn().mockResolvedValue({ activeResourceSlots: 0, enabledResourceSlots: 0 }),
  countActiveBoosts: vi.fn().mockResolvedValue(0),
  countEvaluatedHighRiskUsers: vi.fn().mockResolvedValue(0),
  countRiskEvents: vi.fn().mockResolvedValue(0),
  groupTopRiskEventTypes: vi.fn().mockResolvedValue([]),
  bucketRiskEventSeverity: vi.fn().mockResolvedValue([]),
  listRecentHighSeverityEvents: vi.fn().mockResolvedValue([]),
  countUsersForRiskDistribution: vi.fn().mockResolvedValue(0),
  groupRiskLevelDistribution: vi.fn().mockResolvedValue({}),
};

@Module({
  controllers: [ChatDashboardController],
  providers: [
    ChatDashboardService,
    { provide: ChatDashboardRepository, useValue: repo },
    JwtAuthGuard,
    AdminGuard,
    PermissionsGuard,
  ],
})
class ContractModule {}

const i18n = { t: (_locale: string, key: string) => key } as I18nService;

describe('Chat dashboard HTTP contract', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-29T12:00:00.000Z'));
    app = await NestFactory.create(ContractModule, new ExpressAdapter(express()), { logger: false });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({
      transform: true,
      whitelist: true,
      exceptionFactory: (errors: ValidationError[]) => new I18nHttpException(
        HttpStatus.BAD_REQUEST,
        'common.invalid_params',
        undefined,
        { code: 'BAD_REQUEST', data: { violations: flattenValidationErrors(errors) } },
      ),
    }));
    app.useGlobalInterceptors(new ResponseInterceptor(i18n));
    app.useGlobalFilters(new AllExceptionsFilter(i18n));
    await app.init();
    const server = app.getHttpServer();
    await new Promise<void>((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  beforeEach(() => {
    guardState.currentUser = { id: 'admin-1', currentSystemId: 'chat-id' };
    repo.findSystemCodeById.mockResolvedValue('chat');
  });

  afterAll(async () => {
    await app.close();
    vi.useRealTimers();
  });

  it('retains the real three-layer guard and permission metadata', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, ChatDashboardController)).toEqual([
      JwtAuthGuard,
      AdminGuard,
      PermissionsGuard,
    ]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, ChatDashboardController)).toEqual([
      'chat-dashboard:read',
    ]);
  });

  it.each([
    ['/api/admin/chat-dashboard/pending-inbox', ['galleryPendingCount', 'updatedAt']],
    ['/api/admin/chat-dashboard/generation-health?tz=UTC&window=today', ['range', 'totals', 'topModels']],
    ['/api/admin/chat-dashboard/billing-summary?tz=Europe%2FBerlin&window=yesterday', ['range', 'gmv', 'topPointsConsumers']],
    ['/api/admin/chat-dashboard/content-pulse?tz=UTC&window=last7d', ['range', 'galleryPublished', 'galleryHotTop10']],
    ['/api/admin/chat-dashboard/risk-signals?tz=UTC&window=custom&from=2026-06-01&to=2026-06-15', ['range', 'levelDistribution', 'severityBuckets']],
  ])('GET %s returns the standard envelope and section shape', async (path, keys) => {
    const response = await fetch(`${baseUrl}${path}`);
    const body = await response.json() as { success: boolean; data: Record<string, unknown> };
    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body.success).toBe(true);
    for (const key of keys) expect(body.data).toHaveProperty(key);
  });

  it('returns the complete critical domain shape and preserves monetary strings', async () => {
    const pendingResponse = await fetch(
      `${baseUrl}/api/admin/chat-dashboard/pending-inbox`,
    );
    const pending = await pendingResponse.json() as { data: ChatDashboardPendingInbox };
    expect(pending.data).toMatchObject({
      galleryPendingCount: 1,
      galleryPendingReportCount: 2,
      templatePendingCount: 7,
      templatePendingImageCount: 3,
      templatePendingVideoCount: 4,
      registrationPendingCount: 5,
      riskFlaggedUserCount: 6,
      batchJobProcessingCount: 7,
    });
    expect(typeof pending.data.updatedAt).toBe('string');

    const generationResponse = await fetch(
      `${baseUrl}/api/admin/chat-dashboard/generation-health?tz=UTC&window=today`,
    );
    const generation = await generationResponse.json() as {
      data: ChatDashboardGenerationHealth;
    };
    expect(generation.data.range).toMatchObject({
      window: 'today',
      tz: 'UTC',
      from: '2026-07-29T00:00:00.000Z',
      to: '2026-07-30T00:00:00.000Z',
      isComplete: false,
    });
    expect(generation.data.totals).toEqual({
      total: 0,
      active: 0,
      succeeded: 0,
      failed: 0,
      expired: 0,
    });
    expect(generation.data.byKind).toEqual([
      { kind: 'IMAGE', total: 0, failureRate: null },
      { kind: 'VIDEO', total: 0, failureRate: null },
    ]);

    const billingResponse = await fetch(
      `${baseUrl}/api/admin/chat-dashboard/billing-summary?tz=UTC&window=today`,
    );
    const billing = await billingResponse.json() as {
      data: ChatDashboardBillingSummary;
    };
    expect(billing.data.gmv).toEqual([{ currency: 'USD', amount: '12.50' }]);
    expect(billing.data.refunded).toEqual([{ currency: 'USD', amount: '2.50' }]);
    expect(typeof billing.data.gmv[0].amount).toBe('string');
    expect(billing.data.compareToPrev.gmvDeltaPctByCurrency).toEqual([
      { currency: 'USD', deltaPct: 0 },
    ]);

    const riskResponse = await fetch(
      `${baseUrl}/api/admin/chat-dashboard/risk-signals?tz=UTC&window=today`,
    );
    const risk = await riskResponse.json() as { data: ChatDashboardRiskSignals };
    expect(risk.data.levelDistribution).toEqual({ L0: 0, L1: 0, L2: 0, L3: 0 });
    expect(risk.data.severityBuckets).toEqual(
      ['A', 'B', 'C', 'D', 'E'].map((bucket) => ({ bucket, count: 0 })),
    );
    expect(risk.data).toHaveProperty('evaluatedHighRiskUsersCount', 0);
    expect(risk.data).toHaveProperty('recentHighSeverityEvents');
  });

  it('separates DTO shape, runtime timezone, and calendar range errors', async () => {
    const cases = [
      ['/api/admin/chat-dashboard/generation-health?window=today', 'common.invalid_params'],
      ['/api/admin/chat-dashboard/generation-health?tz=&window=today', 'common.invalid_params'],
      [`/api/admin/chat-dashboard/generation-health?tz=${'x'.repeat(65)}&window=today`, 'common.invalid_params'],
      ['/api/admin/chat-dashboard/generation-health?tz=UTC&window=this_week', 'common.invalid_params'],
      ['/api/admin/chat-dashboard/generation-health?tz=UTC&window=custom&from=2026-06-01', 'common.invalid_params'],
      ['/api/admin/chat-dashboard/generation-health?tz=UTC&window=custom&from=2026-6-01&to=2026-06-15', 'common.invalid_params'],
      ['/api/admin/chat-dashboard/generation-health?tz=Foo%2FBar&window=today', 'admin.chat_dashboard.invalid_timezone'],
      ['/api/admin/chat-dashboard/generation-health?tz=UTC&window=custom&from=2026-02-30&to=2026-03-01', 'admin.chat_dashboard.invalid_range'],
      ['/api/admin/chat-dashboard/generation-health?tz=UTC&window=custom&from=2026-07-20&to=2026-07-19', 'admin.chat_dashboard.invalid_range'],
      ['/api/admin/chat-dashboard/generation-health?tz=UTC&window=custom&from=2026-07-30&to=2026-07-30', 'admin.chat_dashboard.invalid_range'],
      ['/api/admin/chat-dashboard/generation-health?tz=UTC&window=custom&from=2026-04-28&to=2026-07-29', 'admin.chat_dashboard.invalid_range'],
      ['/api/admin/chat-dashboard/generation-health?tz=UTC&window=custom&from=2025-06-23&to=2025-06-23', 'admin.chat_dashboard.invalid_range'],
    ] as const;
    for (const [path, message] of cases) {
      const response = await fetch(`${baseUrl}${path}`);
      const body = await response.json() as { success: boolean; msg: string };
      expect(response.status, JSON.stringify(body)).toBe(400);
      expect(body).toMatchObject({ success: false, msg: message });
    }
  });

  it('discards custom fields from preset requests', async () => {
    const response = await fetch(
      `${baseUrl}/api/admin/chat-dashboard/content-pulse?tz=UTC&window=today&from=2099-01-01&to=2099-01-02`,
    );
    const body = await response.json() as {
      success: boolean;
      data: { range: Record<string, unknown> };
    };
    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body.data.range).toMatchObject({ window: 'today', tz: 'UTC' });
    expect(body.data.range).not.toHaveProperty('fromDate');
    expect(body.data.range).not.toHaveProperty('toDate');
  });

  it('returns the exact wrong-System error for missing, non-chat, and unknown systems', async () => {
    guardState.currentUser = { id: 'admin-1' };
    let response = await fetch(`${baseUrl}/api/admin/chat-dashboard/pending-inbox`);
    expect(await response.json()).toMatchObject({ success: false, msg: 'auth.system.not_in_chat_system' });
    for (const code of ['admin-system', null]) {
      guardState.currentUser = { id: 'admin-1', currentSystemId: 'other-id' };
      repo.findSystemCodeById.mockResolvedValueOnce(code);
      response = await fetch(`${baseUrl}/api/admin/chat-dashboard/pending-inbox`);
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ success: false, msg: 'auth.system.not_in_chat_system' });
    }
  });
});
