"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      router.push("/app");
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
            <label className="block text-sm font-medium text-gray-700 mb-1.5">邮箱</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1.5">密码</label>
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
          <Link href="/register" className="text-tomato-600 hover:text-tomato-700 font-medium">
            立即注册
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
