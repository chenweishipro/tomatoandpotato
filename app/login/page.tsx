"use client";
import { useT } from "@/lib/i18n";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { WechatQrModal } from "@/components/wechat-qr-modal";

export default function LoginPage() {
  const { t } = useT();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [wechatOpen, setWechatOpen] = useState(false);

  // 处理 wechat_bind 回调结果
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const wechatErr = params.get("error");
    if (wechatErr && wechatErr.startsWith("wechat_")) {
      const errMap: Record<string, string> = {
        wechat_no_code: "微信回调缺少 code",
        wechat_failed: "微信登录失败",
        wechat_bind_unauthorized: "绑定失败：请先登录",
      };
      if (!error) setError(errMap[wechatErr] || `微信错误: ${wechatErr}`);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("邮箱或密码错误");
    } else {
      router.push("/app/");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">🍅</div>
          <h1 className="text-2xl font-bold text-gray-900">番茄土豆</h1>
          <p className="text-sm text-gray-500 mt-1">专注每一刻</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("auth.email")}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white focus:border-tomato-400 outline-none transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("auth.password")}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              minLength={6}
              placeholder="至少 6 位"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white focus:border-tomato-400 outline-none transition"
            />
          </div>

          {error && (
            <div className="text-sm text-tomato-700 bg-tomato-50 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-tomato-500 hover:bg-tomato-600 disabled:opacity-60 text-white font-medium rounded-xl transition active:scale-[0.98]"
          >
            {loading ? "登录中…" : "登录"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-5">
          还没有账号？{" "}
          <Link href="/register/" className="text-tomato-600 hover:text-tomato-700 font-medium">
            立即注册
          </Link>
        </p>
        <p className="text-center text-sm text-gray-500 mt-2">
          <Link href="/forgot-password/" className="text-tomato-600 hover:text-tomato-700">
            {t("auth.forgotPassword")}
          </Link>
        </p>

        {/* 分隔线 */}
        <div className="flex items-center gap-3 mt-6">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">或</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* 微信登录 */}
        <button
          onClick={() => setWechatOpen(true)}
          className="w-full mt-4 py-2.5 bg-[#07c160] hover:bg-[#06ae56] text-white font-medium rounded-xl transition active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8.69 11.52c-.36 0-.65-.3-.65-.66s.29-.66.65-.66.66.3.66.66-.3.66-.66.66zm6.62 0c-.36 0-.65-.3-.65-.66s.29-.66.65-.66.66.3.66.66-.3.66-.66.66zM9.4 18.36c-3.91 0-7.08-2.5-7.08-5.59 0-3.08 3.17-5.59 7.08-5.59s7.08 2.5 7.08 5.59c0 .31-.03.61-.08.91-.49-.13-1-.21-1.54-.21-3.36 0-6.09 2.16-6.09 4.82 0 .02 0 .05.01.07h-.38zm11.86-1.51c-2.7 0-4.89-1.74-4.89-3.88 0-2.14 2.19-3.88 4.89-3.88s4.89 1.74 4.89 3.88c0 .92-.41 1.76-1.1 2.42l.43 1.36-1.55-.78c-.77.16-1.57.16-2.67.16v.72zm-2.42-2.74c-.27 0-.49-.22-.49-.49s.22-.49.49-.49.49.22.49.49-.22.49-.49.49zm4.84 0c-.27 0-.49-.22-.49-.49s.22-.49.49-.49.49.22.49.49-.22.49-.49.49z" />
          </svg>
          微信登录
        </button>

        <WechatQrModal open={wechatOpen} onClose={() => setWechatOpen(false)} intent="login" />
      </motion.div>
    </div>
  );
}
