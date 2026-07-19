import type { AddressInfo } from 'node:net';
import { Module, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyEarlyMiddlewares } from './http-bootstrap';
import { AllExceptionsFilter } from './all-exceptions.filter';
import type { I18nService } from '../i18n/i18n.service';

// 评审 P3：`all-exceptions.filter.spec.ts` 只 unit-test 了 filter 自身，无法验证真实的
// 中间件顺序契约（trace → helmet → CORS → body parser → Nest filter）。
// 早期错误（非法 JSON / 413 payload）由 body-parser 直接产生 SyntaxError/PayloadTooLarge，
// 只要装配顺序正确，CORS 就应先于 body-parser 挂上响应头，浏览器才能读到；
// 同时 trace bootstrap 早于所有中间件，保证 X-Request-Id 与 body.traceId 一致。
//
// 该 spec 用 Nest ExpressAdapter 起真实 HTTP server，跑真实请求，避免把顺序 bug 藏起来。

@Module({})
class TestModule {}

const i18nStub: Pick<I18nService, 't'> = {
  t: (_lang: string, key: string) => key,
};

async function bootstrapTestApp(): Promise<{
  app: INestApplication;
  baseUrl: string;
}> {
  const app = await NestFactory.create(
    TestModule,
    new ExpressAdapter(express()),
    { bodyParser: false, logger: false },
  );
  app.setGlobalPrefix('api');
  // 用 spec 专用的低 bodyLimit（1kb）触发 413，避免真的发 15mb 数据。
  applyEarlyMiddlewares(app, { bodyLimit: '1kb' });
  app.useGlobalFilters(new AllExceptionsFilter(i18nStub as I18nService));
  await app.init();

  const server = app.getHttpServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  return { app, baseUrl: `http://127.0.0.1:${port}` };
}

describe('early-middleware integration (trace → helmet → CORS → body parser)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const started = await bootstrapTestApp();
    app = started.app;
    baseUrl = started.baseUrl;
  });

  afterAll(async () => {
    await app.close();
  });

  it('非法 JSON 请求也返回 CORS 响应头 + X-Request-Id，且 body.traceId 与 header 一致', async () => {
    const res = await fetch(`${baseUrl}/api/anything`, {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:3000',
        'Content-Type': 'application/json',
      },
      body: '{ not valid json',
    });

    // body-parser 拒绝非法 JSON → Nest filter 返回 400。
    expect(res.status).toBe(400);
    // CORS 早于 body-parser：Access-Control-Allow-Origin 必须存在。
    expect(res.headers.get('access-control-allow-origin')).toBe(
      'http://localhost:3000',
    );
    // Expose-Headers 让浏览器能真正读到追踪头。
    const exposed = res.headers.get('access-control-expose-headers') ?? '';
    expect(exposed.toLowerCase()).toContain('x-request-id');

    const requestIdHeader = res.headers.get('x-request-id');
    expect(requestIdHeader).toBeTruthy();

    const body = (await res.json()) as {
      success: boolean;
      code: string;
      traceId: string;
    };
    expect(body.success).toBe(false);
    // 非法 JSON 属于典型客户端错误：body.code 必须是 BAD_REQUEST，
    // 不能是通用兜底 INTERNAL_ERROR（评审 P2：响应语义与 HTTP 状态一致）。
    expect(body.code).toBe('BAD_REQUEST');
    // trace bootstrap 早于 body-parser，body.traceId 必须与响应头一致——
    // 前端才能把这条早期错误关联回自己的 traceId。
    expect(body.traceId).toBe(requestIdHeader);
  });

  it('413 payload 超限也返回 CORS 响应头 + 一致的 X-Request-Id / body.traceId', async () => {
    // bodyLimit=1kb；发 8kb JSON body 触发 PayloadTooLargeError。
    const oversized = JSON.stringify({ blob: 'x'.repeat(8 * 1024) });
    const res = await fetch(`${baseUrl}/api/anything`, {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:3000',
        'Content-Type': 'application/json',
      },
      body: oversized,
    });

    expect(res.status).toBe(413);
    expect(res.headers.get('access-control-allow-origin')).toBe(
      'http://localhost:3000',
    );
    const exposed = res.headers.get('access-control-expose-headers') ?? '';
    expect(exposed.toLowerCase()).toContain('x-request-id');

    const requestIdHeader = res.headers.get('x-request-id');
    expect(requestIdHeader).toBeTruthy();

    const body = (await res.json()) as {
      success: boolean;
      code: string;
      traceId: string;
    };
    expect(body.success).toBe(false);
    // 413 必须映射到专门的 PAYLOAD_TOO_LARGE 领域码，让 SDK/UI 能与
    // "服务端 500" 区分开（评审 P2）。
    expect(body.code).toBe('PAYLOAD_TOO_LARGE');
    expect(body.traceId).toBe(requestIdHeader);
  });

  it('客户端预置合法 X-Request-Id 时，会被 bootstrap 复用而不是覆盖', async () => {
    const presetId = 'client-preset-req-12345678';
    const res = await fetch(`${baseUrl}/api/anything`, {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:3000',
        'Content-Type': 'application/json',
        'X-Request-Id': presetId,
      },
      body: '{ still bad',
    });

    expect(res.status).toBe(400);
    expect(res.headers.get('x-request-id')).toBe(presetId);
    const body = (await res.json()) as { traceId: string; code: string };
    expect(body.traceId).toBe(presetId);
    expect(body.code).toBe('BAD_REQUEST');
  });
});
