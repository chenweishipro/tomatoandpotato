import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "🍅 番茄土豆",
  description: "极简好用的番茄工作法 + Todo",
  manifest: "/tomato/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "番茄土豆",
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
        <link rel="icon" href="/tomato/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/tomato/icon.svg" />
      </head>
      <body className="bg-white dark:bg-slate-950 text-gray-900 dark:text-gray-100 transition-colors">
        <Providers>{children}</Providers>
        <script
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/tomato/sw.js').catch(() => {}); }`,
          }}
        />
      </body>
    </html>
  );
}