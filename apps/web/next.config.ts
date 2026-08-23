import type { NextConfig } from "next";

const API_ORIGIN = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/raffles/:id",
        destination: "/raffle-entry/:id",
      },
      {
        source: "/api/raffles/public",
        destination: `${API_ORIGIN}/api/raffles`,
      },
      {
        source: "/api/:path*",
        destination: `${API_ORIGIN}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
