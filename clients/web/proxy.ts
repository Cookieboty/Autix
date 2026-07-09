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
  const action = resolveProxyAction(pathname, search, getApiOrigin());

  switch (action.type) {
    case 'rewrite':
      return NextResponse.rewrite(new URL(action.url, req.url));
    case 'redirect':
      return NextResponse.redirect(new URL(action.url, req.url), action.status);
    case 'intl':
      return handleIntl(req);
  }
}

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
};
