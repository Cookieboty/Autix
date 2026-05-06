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
