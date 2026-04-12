import type { NextConfig } from "next";

const CHAT_API = process.env.NEXT_PUBLIC_CHAT_API_URL || 'http://localhost:4001';

const nextConfig: NextConfig = {
  rewrites: async () => [
    {
      source: '/api/sse/:path*',
      destination: `${CHAT_API}/api/sse/:path*`,
    },
  ],
};

export default nextConfig;
