import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';
import { buildLegacyRedirects } from './lib/legacy-redirects';

// 注意：BFF 代理（/api/*）在 middleware.ts 中实现。
// next.config.ts 里的 rewrites destination 在 build 时被烤进 routes-manifest，
// 运行时换 docker-compose 的环境变量是改不动的。

const nextConfig: NextConfig = {
  output: 'standalone',
  allowedDevOrigins: ['127.0.0.1'],
  experimental: {
    proxyTimeout: 600_000,
    optimizePackageImports: [
      'radix-ui',
      'react-syntax-highlighter',
      'react-day-picker',
    ],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'cdn.amux.ai' },
    ],
    unoptimized: true,
  },
  transpilePackages: [
    '@autix/domain',
    '@autix/i18n',
    '@autix/platform',
    '@autix/sdk',
    '@autix/shared-store',
    '@autix/shared-ui',
  ],
  redirects: async () => buildLegacyRedirects(),
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
