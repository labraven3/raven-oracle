import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  // Proxy /api/* requests to Express API server on localhost:4000
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:4000/api/:path*',
      },
    ];
  },
};

export default nextConfig;
