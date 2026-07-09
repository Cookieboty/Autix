import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { resolveProxyAction } from './lib/proxy-handler';

/**
 * BFF 反向代理 + @handle 虚荣链接 + next-intl locale 路由。
 *
 * 为什么放在 proxy 而不是 next.config.ts 的 rewrites：
 * next.config.ts 在 build 时执行，env 会被烤进 routes-manifest.json，
 * 运行时改 docker-compose 环境变量改不动。本函数体每次请求都重新读
 * process.env，是真运行时。
 */
const handleIntl = createMiddleware(routing);

function getApiOrigin(): string {
  return (process.env.API_URL || 'http://localhost:4000')
    .replace(/\/+$/, '')
    .replace(/\/api$/, '');
}

export default function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const localeCookie = req.cookies.get('NEXT_LOCALE')?.value;
  const action = resolveProxyAction(pathname, search, getApiOrigin(), localeCookie);

  switch (action.type) {
    case 'rewrite':
      return NextResponse.rewrite(new URL(action.url, req.url));
    case 'redirect': {
      const res = NextResponse.redirect(new URL(action.url, req.url), action.status);
      // 302（根路径按 cookie 跳转）的决策依赖请求 cookie，绝不能被共享缓存存储——
      // 否则下一个无 cookie 的访客（Googlebot 等）会拿到被缓存的跳转。301（@handle
      // 去默认 locale 前缀）是纯路径规范化，与 cookie 无关，无需此头。
      if (action.status === 302) {
        res.headers.set('Cache-Control', 'private, no-store');
      }
      return res;
    }
    case 'intl':
      return handleIntl(req);
  }
}

export const config = {
  // 三条规则叠加覆盖旧 middleware.ts 的 ['/api/:path*', '/@:handle']：
  // 1) 常规 intl 路由，排除 _next 与带点号的静态资源；
  // 2) /api/* 反代必须放行带点号路径（如 /api/download/report.pdf、a@b.com 邮箱型 handle）；
  // 3) @handle 虚荣链接同理必须放行带点号 handle（裸路径 + 各 locale 前缀，含默认
  //    locale 前缀本身，因为 /en/@handle 需要在 proxy() 里被 301 去前缀）。
  //
  // locale 字面量在此手写（Next 要求 config.matcher 编译期静态可分析，不能从
  // routing 里 import/map），与 routing.locales 的同步由
  // test/proxy-handler.test.ts 的 matcher-sync 用例兜底。
  matcher: [
    '/((?!_next|.*\\..*).*)',
    '/api/:path*',
    '/@:handle',
    '/:locale(zh-CN|zh-TW|en|fr|ja|ru|vi)/@:handle',
  ],
};
