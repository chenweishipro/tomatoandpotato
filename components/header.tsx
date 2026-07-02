"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { BarChart3, Settings, Timer, History, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-provider";

const links = [
  { href: "/app", label: "专注", icon: Timer },
  { href: "/app/stats", label: "统计", icon: BarChart3 },
  { href: "/app/history", label: "历史", icon: History },
  { href: "/app/settings", label: "设置", icon: Settings },
];

export function Header({ user }: { user: { name?: string | null; email?: string | null } }) {
  const pathname = usePathname();
  const router = useRouter();
  const initial = (user.name ?? user.email ?? "?")[0]!.toUpperCase();

  return (
    <header className="sticky top-0 z-30 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border-b border-gray-100 dark:border-slate-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
        <Link href="/app" className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
          <span className="text-xl">🥕</span>
          <span className="hidden sm:inline">胡萝卜</span>
        </Link>

        <nav className="flex-1 flex items-center gap-1 ml-2 sm:ml-6">
          {links.map(({ href, label, icon: Icon }) => {
            const active = href === "/app" ? pathname === "/app" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-sm transition",
                  active
                    ? "bg-tomato-50 text-tomato-700 dark:bg-tomato-900/30 dark:text-tomato-300"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-gray-100"
                )}
              >
                <Icon size={16} />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-tomato-400 to-tomato-600 text-white text-sm font-medium flex items-center justify-center">
            {initial}
          </div>
          <button
            onClick={async () => {
              // signOut 内部 callbackUrl 不会自动加 basePath, 手动 redirect
              await signOut({ redirect: false });
              router.push("/login/");
            }}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 flex items-center gap-1 px-1.5 py-1 sm:px-0 sm:py-0"
            aria-label="登出"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">退出</span>
          </button>
        </div>
      </div>
    </header>
  );
}
