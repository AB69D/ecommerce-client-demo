/** @type {import('next').NextConfig} */
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

const nextConfig = {
  // Docker/VPS deploys need 'standalone'; Vercel's own build output tracing
  // breaks (404s on every route) if this is set, so skip it there.
  output: process.env.VERCEL ? undefined : 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'fastly.picsum.photos' },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
