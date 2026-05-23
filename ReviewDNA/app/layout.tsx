import './globals.css';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ReviewDNA',
  description: 'AI-powered GitHub PR review bot'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
