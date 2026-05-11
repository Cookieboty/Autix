import { NextResponse, type NextRequest } from 'next/server';

/**
 * BFF 反向代理（运行时）：
 *   /user-api/*  →  USER_API_URL/api/*  (user-system)
 *   /api/*       →  CHAT_API_URL/api/*  (chat)
 *
 * 为什么放在 middleware 而不是 next.config.ts 的 rewrites：
 * next.config.ts 在 build 时执行，env 会被烤进 routes-manifest.json，
 * 运行时改 docker-compose 环境变量改不动。middleware 函数体每次请求都
 * 重新读 process.env，是真运行时。
 *
 * 生产环境 /api/* 通常被外层反代（Cloudflare/Nginx）直接路由到 chat 服务，
 * 根本不会回源到本容器。这里的 /api/* 兜底是为了：
 *   - 本地 dev 没反代时仍可用
 *   - 生产链路出问题时有保底
 */
export const config = {
  matcher: ['/user-api/:path*', '/api/:path*'],
};

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (pathname.startsWith('/user-api/')) {
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

  if (pathname.startsWith('/api/')) {
    const target = process.env.CHAT_API_URL;
    if (!target) {
      return NextResponse.json(
        { error: 'CHAT_API_URL not configured' },
        { status: 500 },
      );
    }
    return NextResponse.rewrite(new URL(`${target}${pathname}${search}`));
  }

  return NextResponse.next();
}
