import type { Metadata } from "next";
import "./globals.css";
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: "Amux Admin - 用户管理系统",
  description: "Amux Admin 用户权限管理系统",
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased h-full min-h-screen">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
