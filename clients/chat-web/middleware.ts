import { NextResponse, type NextRequest } from 'next/server';

/**
 * BFF 反向代理：
 *   /user-api/*  →  USER_API_URL/api/*  (user-system)
 *   /api/*       →  CHAT_API_URL/api/*  (chat)
 *
 * 为什么放在 middleware 而不是 next.config.ts 的 rewrites：
 * next.config.ts 在 build 时执行，process.env 会被烤进
 * .next/routes-manifest.json，运行时换 docker-compose 环境变量改不掉。
 * middleware 函数体每次请求都重新读 process.env，是真运行时。
 *
 * 生产环境中 /api/* 通常由外层反向代理（Cloudflare/Nginx）直接路由到
 * chat 服务，不回源到本容器；dev 环境没有外层代理，由此处兜底。
 * 若 CHAT_API_URL 未设置，则透传（交给 Next.js 的 404 处理）。
 */
export const config = {
  matcher: ['/user-api/:path*', '/api/:path*'],
};

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (pathname.startsWith('/user-api')) {
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

  // /api/* → chat service
  const chatTarget = process.env.CHAT_API_URL;
  if (!chatTarget) {
    return NextResponse.next();
  }
  return NextResponse.rewrite(new URL(`${chatTarget}${pathname}${search}`));
}
