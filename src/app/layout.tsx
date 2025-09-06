
import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { GeistSans } from 'geist/font/sans';

export const metadata: Metadata = {
  title: 'PT FARIKA RIAU PERKASA',
  description: 'Real-time monitoring for batching plant material scales.',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable}`}>
      <head>
        <meta name="application-name" content="Farika App" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Farika App" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#f59e0b" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="theme-color" content="#1c1917" />

        <link rel="icon" href="/favicon.ico" />
        
      </head>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
