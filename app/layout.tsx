import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hyatt Email Template',
  description: 'Build reusable Hyatt email templates from selectable topics.',
  icons: {
    icon: '/favicon.png'
  }
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
