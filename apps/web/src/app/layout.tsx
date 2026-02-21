import type { Metadata, Viewport } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'KPATA AI',
  description: 'Studio photo IA instantané pour vendeurs vêtement & Beauté',
};

export const viewport: Viewport = {
  themeColor: '#10b981',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
