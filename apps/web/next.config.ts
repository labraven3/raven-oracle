import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  // Proxy /api/* requests to Express API server
  async rewrites() {
    // On production, use environment variable API_URL
    // On development, use localhost:4000
    const apiUrl = process.env.API_URL || 'http://localhost:4000';
    
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
