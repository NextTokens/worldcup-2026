/** @type {import('next').NextConfig} */
const nextConfig = {
  // This app lives in a subdirectory of the repo; pin the trace root so the
  // standalone bundle is built from here and not the repo root.
  outputFileTracingRoot: import.meta.dirname,
  // Railway/Nixpacks: standalone output keeps the runtime image small.
  output: 'standalone',
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    // Server Actions receive form payloads only; keep the limit modest.
    serverActions: { bodySizeLimit: '1mb' },
  },
};

export default nextConfig;
