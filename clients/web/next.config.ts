import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@repo/contracts"],
  output: "standalone",
  outputFileTracingRoot: new URL(".", import.meta.url).pathname.slice(0, -1),
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:3001/api/:path*",
      },
      {
        source: "/requirement/:path*",
        destination: "http://localhost:3001/requirement/:path*",
      },
    ];
  },
};

export default nextConfig;
