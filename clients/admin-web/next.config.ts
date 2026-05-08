import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const USER_API = process.env.USER_API_URL || 'http://localhost:4002';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: [
    '@autix/shared-lib',
    '@autix/shared-store',
    '@autix/shared-ui',
  ],
  rewrites: async () => [
    { source: '/api/:path*', destination: `${USER_API}/api/:path*` },
  ],
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
