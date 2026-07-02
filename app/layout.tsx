import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "🥕 胡萝卜",
  description: "极简好用的胡萝卜时间管理 + Todo",
  manifest: "/carrot/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "胡萝卜",
  },
};

export const viewport: Viewport = {
  themeColor: "#fa472f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/carrot/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/carrot/icon.svg" />
      </head>
      <body className="bg-white dark:bg-slate-950 text-gray-900 dark:text-gray-100 transition-colors">
        <Providers>{children}</Providers>

      </body>
    </html>
  );
}