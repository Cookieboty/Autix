import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: [
    '@autix/shared-lib',
    '@autix/shared-store',
    '@autix/shared-ui',
  ],
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
