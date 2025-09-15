import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async rewrites() {
    return [
      {
        source: "/api/threads/:path*",
        destination: `https://api.openai.com/v1/threads/:path*`,
      },
    ];
  },
};

export default nextConfig;
