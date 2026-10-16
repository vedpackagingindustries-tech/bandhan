import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "https://preview-chat-*.space-z.ai",
    "https://preview-*.space-z.ai",
  ],
  typescript: {
    ignoreBuildErrors: false,
  },
  serverExternalPackages: ['@prisma/client', '@prisma/client/default'],
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  // Enterprise security headers applied at edge
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          // ─── Security Headers ───
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          // ─── CORS: Restricted to Bandhan domains only ───
          { key: 'Access-Control-Allow-Origin', value: 'https://bandhan-sahu-connect.vercel.app' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Max-Age', value: '86400' },
          // ─── Content Security Policy ───
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://bandhan-sahu-connect.vercel.app; font-src 'self' data:; connect-src 'self' https://bandhan-sahu-connect.vercel.app https://*.supabase.co https://api.resend.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self';" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https://bandhan-sahu-connect.vercel.app https://images.unsplash.com; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://bandhan-sahu-connect.vercel.app https://*.supabase.co https://api.resend.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self';" },
        ],
      },
    ];
  },
};

export default nextConfig;
