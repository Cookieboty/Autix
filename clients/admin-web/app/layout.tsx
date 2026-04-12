import type { Metadata } from "next";
import "./globals.css";
import { Providers } from '@/components/providers';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: "Autix - 用户管理系统",
  description: "Autix 用户权限管理系统",
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
          <Toaster richColors position="top-right" />
        </Providers>
      </body>
    </html>
  );
}
