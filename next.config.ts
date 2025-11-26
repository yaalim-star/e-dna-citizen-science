import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pages Router 사용 명시
  experimental: {
    // App Router 비활성화 (Pages Router만 사용)
  },
};

export default nextConfig;
