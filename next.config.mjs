import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Railway: emit a standalone server bundle (node .next/standalone/server.js)
  output: 'standalone',
  // Type errors still fail the build; lint style does not block compile verification.
  eslint: { ignoreDuringBuilds: true },
  images: {
    // Crests/flags/headshots come from external public sources (Wikimedia, crests.football-data.org, etc.)
    remotePatterns: [
      { protocol: 'https', hostname: 'a.espncdn.com' },
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      { protocol: 'https', hostname: 'commons.wikimedia.org' },
      { protocol: 'https', hostname: 'flagcdn.com' },
    ],
  },
};

export default withNextIntl(nextConfig);
