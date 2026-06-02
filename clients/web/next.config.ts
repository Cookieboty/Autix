import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

// 注意：BFF 代理（/api/*）在 middleware.ts 中实现。
// next.config.ts 里的 rewrites destination 在 build 时被烤进 routes-manifest，
// 运行时换 docker-compose 的环境变量是改不动的。

const nextConfig: NextConfig = {
  output: 'standalone',
  allowedDevOrigins: ['127.0.0.1'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'cdn.amux.ai' },
    ],
    unoptimized: true,
  },
  transpilePackages: [
    '@autix/shared-lib',
    '@autix/shared-store',
    '@autix/shared-ui',
  ],
  redirects: async () => [
    { source: '/system', destination: '/admin', permanent: true },
    { source: '/system/templates', destination: '/admin/templates', permanent: true },
    {
      source: '/system/membership/:path*',
      destination: '/admin/membership/:path*',
      permanent: true,
    },
    { source: '/permission-center', destination: '/admin/permission-center', permanent: true },
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
