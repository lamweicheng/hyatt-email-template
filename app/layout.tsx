import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hyatt Tier List',
  description: 'Curate your own Hyatt tier list across the full brand portfolio.'
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
