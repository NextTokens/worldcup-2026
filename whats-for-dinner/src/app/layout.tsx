import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "What's for Dinner",
  description:
    "Decide tonight's dinner from what your family already has, and keep the shopping list topped up.",
  applicationName: "What's for Dinner",
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fdf8f3' },
    { media: '(prefers-color-scheme: dark)', color: '#17120f' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
