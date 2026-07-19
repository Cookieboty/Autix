import type { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { createTraceContextBootstrap } from './trace-context.bootstrap';

/**
 * 早期中间件装配（trace bootstrap → helmet → CORS → body parser）。
 *
 * 抽成独立函数的两个理由：
 * 1) 顺序是安全和可观测性契约，必须保证 main.ts 和集成测试完全一致；
 *    在 spec 里再抄一遍是回归 P2 顺序 bug 的最短路径。
 * 2) 让评审 P2 描述的"带 Origin 的非法 JSON / 413 payload 也能被浏览器读到 CORS/
 *    X-Request-Id"具备可测试性。
 *
 * 顺序不可变：
 * - trace bootstrap 最先——所有响应必须能带上 X-Request-Id，包括 parser/CORS 抛的错。
 * - helmet 紧随其后——安全头即使在 parser 早失败路径也要落到响应。
 * - CORS 在 body parser **之前**——非法 JSON / 413 payload 会被 body-parser 直接
 *   拒绝，如果 CORS 在 parser 后，那浏览器就读不到 Access-Control-Allow-Origin /
 *   Expose-Headers，前端也就无法把早期错误关联回自己的 traceId。
 * - body parser 最后——上面三层都跑过一遍再解 JSON。
 */
export interface EarlyMiddlewareOptions {
  corsOrigin?: string;
  /** JSON / urlencoded body size limit。生产默认 15mb，spec 可下调制造 413。 */
  bodyLimit?: string;
  /** 交给 express.json 的 verify 钩子（如 Stripe raw body 捕获）。 */
  verify?: (req: unknown, res: unknown, buf: Buffer) => void;
}

export function applyEarlyMiddlewares(
  app: INestApplication,
  options: EarlyMiddlewareOptions = {},
): void {
  const bodyLimit = options.bodyLimit ?? '15mb';

  app.use(createTraceContextBootstrap());
  app.use(helmet());

  const corsCommon = {
    credentials: true,
    // 让前端可以在跨域场景下读取到响应中的追踪头（否则浏览器会隐藏这些头）。
    exposedHeaders: ['X-Request-Id', 'X-Correlation-Id'],
    // 预检结果缓存 10 分钟，避免带自定义头的请求每次都触发 OPTIONS。
    maxAge: 600,
  };
  app.enableCors(
    options.corsOrigin
      ? { origin: options.corsOrigin.split(',').map((s) => s.trim()), ...corsCommon }
      : { origin: 'http://localhost:3000', ...corsCommon },
  );

  app.use(json({ limit: bodyLimit, verify: options.verify }));
  app.use(urlencoded({ limit: bodyLimit, extended: true, verify: options.verify }));
}
