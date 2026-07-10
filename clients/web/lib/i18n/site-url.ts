/**
 * 读取 `NEXT_PUBLIC_SITE_URL` 并构造站点基址。
 *
 * 导出为函数（而非只导出计算结果）是刻意的：`build-alternates.ts` 在每次调用
 * `buildAlternates()` 时都要重新读取——不能依赖模块加载那一刻的快照。原因：
 * 测试通过 `beforeAll` 设置 `process.env.NEXT_PUBLIC_SITE_URL`，而模块的静态
 * import 图（包括本文件）在该 `beforeAll` 回调真正执行之前就已完成求值（ESM
 * 的 `await import()` 在测试文件顶层会先于 `beforeAll` 运行）。若 `SITE_URL`
 * 是在模块加载时算好并冻结的常量，测试里对 `process.env` 的修改将永远读不到。
 */
export function resolveSiteUrl(): URL {
  const raw = process.env.NEXT_PUBLIC_SITE_URL;

  if (!raw && process.env.NODE_ENV === 'production') {
    throw new Error(
      'NEXT_PUBLIC_SITE_URL is not set. Production builds must provide an absolute site URL, ' +
        'otherwise sitemap and hreflang output will point to localhost.',
    );
  }

  return new URL(raw ?? 'http://localhost:3100');
}

/**
 * 供 `app/[locale]/layout.tsx` 等一次性、模块加载期消费者使用的稳定引用。
 * 在生产环境下，若 `NEXT_PUBLIC_SITE_URL` 未设置，这里会在 import 时就抛错，
 * 阻止构建把 `http://localhost:3100` 烘焙进产物。
 */
export const SITE_URL = resolveSiteUrl();
