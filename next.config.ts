import type { NextConfig } from "next";

const supabaseBannerImagePattern = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(
      "/storage/v1/object/public/site-banners/**",
      process.env.NEXT_PUBLIC_SUPABASE_URL
    )
  : undefined;

const supabaseCardImagePattern = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(
      "/storage/v1/object/public/card-images/**",
      process.env.NEXT_PUBLIC_SUPABASE_URL
    )
  : undefined;

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '8mb',
    },
  },
  allowedDevOrigins: [
    '10.*.*.*',
    '172.*.*.*',
    '192.168.*.*',
    '100.*.*.*',
    '*.local',
    '*.localdomain',
    '*.ts.net',
  ],
  images: {
    remotePatterns: [
      supabaseBannerImagePattern,
      supabaseCardImagePattern,
    ].filter((pattern) => pattern !== undefined),
  },
};

export default nextConfig;
