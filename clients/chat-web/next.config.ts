import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const CHAT_API = process.env.NEXT_PUBLIC_CHAT_API_URL || 'http://localhost:4001';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: [
    '@autix/shared-lib',
    '@autix/shared-store',
    '@autix/shared-ui',
  ],
  rewrites: async () => [
    {
      source: '/api/sse/:path*',
      destination: `${CHAT_API}/api/sse/:path*`,
    },
  ],
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
