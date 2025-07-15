import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/thorium-viewer.html',
        destination: '/api/static/thorium-viewer.html',
      },
      {
        source: '/thorium-viewer.js',
        destination: '/api/static/thorium-viewer.js',
      },
      {
        source: '/temp/:path*',
        destination: '/api/temp/:path*',
      },
    ];
  },
};

export default nextConfig;
