import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

// 注意：BFF 代理（/api/*, /user-api/*）在 middleware.ts 中实现。
// next.config.ts 里的 rewrites destination 在 build 时被烤进 routes-manifest，
// 运行时换 docker-compose 的环境变量是改不动的。

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: [
    '@autix/shared-lib',
    '@autix/shared-store',
    '@autix/shared-ui',
  ],
  redirects: async () => [
    { source: '/templates/mine', destination: '/profile?tab=published', permanent: true },
    { source: '/templates/submit', destination: '/marketplace/image-templates', permanent: true },
    { source: '/marketplace/image-templates/new', destination: '/marketplace/image-templates', permanent: true },
    { source: '/templates/workspace/:id', destination: '/marketplace/image-templates/:id', permanent: true },
    { source: '/templates/:id', destination: '/marketplace/image-templates/:id', permanent: true },
    { source: '/templates', destination: '/marketplace/image-templates', permanent: true },
  ],
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
