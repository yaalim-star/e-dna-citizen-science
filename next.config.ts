import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pages Router 사용 명시
  experimental: {
    // App Router 비활성화 (Pages Router만 사용)
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
