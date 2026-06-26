import { NextResponse, type NextRequest } from 'next/server';

/**
 * BFF 反向代理（运行时）：
 *   /api/*       →  API_URL/api/*  (services/api)
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
  matcher: ['/api/:path*', '/models/:path*', '/@:handle'],
};

function getApiOrigin(): string {
  return (process.env.API_URL || 'http://localhost:4000')
    .replace(/\/+$/, '')
    .replace(/\/api$/, '');
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (pathname.startsWith('/api/')) {
    return NextResponse.rewrite(new URL(`${getApiOrigin()}${pathname}${search}`));
  }

  if (pathname === '/models' || pathname.startsWith('/models/')) {
    return handleUserModelsRoute(req);
  }

  if (pathname.startsWith('/@') && !pathname.slice(2).includes('/')) {
    const handle = pathname.slice(2);
    if (handle) {
      return NextResponse.rewrite(new URL(`/u/${handle}${search}`, req.url));
    }
  }

  return NextResponse.next();
}

function readModelConfigEnabled(payload: unknown): boolean | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const maybeWrapped = payload as {
    data?: { features?: { modelConfigEnabled?: boolean } };
    features?: { modelConfigEnabled?: boolean };
  };
  return maybeWrapped.features?.modelConfigEnabled ?? maybeWrapped.data?.features?.modelConfigEnabled;
}

async function handleUserModelsRoute(req: NextRequest) {
  try {
    const res = await fetch(`${getApiOrigin()}/api/system-settings/public`, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.next();

    const modelConfigEnabled = readModelConfigEnabled(await res.json());
    if (modelConfigEnabled === false) {
      return NextResponse.redirect(new URL('/', req.url));
    }
  } catch {
    return NextResponse.next();
  }

  return NextResponse.next();
}
