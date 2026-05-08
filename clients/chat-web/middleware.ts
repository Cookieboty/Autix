import { NextResponse, type NextRequest } from 'next/server';

/**
 * BFF 反向代理：/user-api/*  →  USER_API_URL/api/*  (user-system)
 *
 * 为什么放在 middleware 而不是 next.config.ts 的 rewrites：
 * next.config.ts 在 build 时执行，process.env.USER_API_URL 会被烤进
 * .next/routes-manifest.json，运行时换 docker-compose 环境变量改不掉。
 * middleware 函数体每次请求都重新读 process.env，是真运行时。
 *
 * /api/* 不在这里处理：由外层反向代理（Cloudflare/Nginx）直接路由到
 * chat 服务，根本不会回源到本容器。
 */
export const config = {
  matcher: ['/user-api/:path*'],
};

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const target = process.env.USER_API_URL;

  if (!target) {
    return NextResponse.json(
      { error: 'USER_API_URL not configured' },
      { status: 500 },
    );
  }

  return NextResponse.rewrite(
    new URL(`${target}/api${pathname.slice('/user-api'.length)}${search}`),
  );
}
