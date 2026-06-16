"use client";
import { apiFetch } from "@/lib/api-client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await apiFetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "注册失败");
      setLoading(false);
      return;
    }

    // 自动登录
    await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    router.push("/tomato/app/");
    router.refresh();
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
          <h1 className="text-2xl font-bold text-gray-900">开始使用</h1>
          <p className="text-sm text-gray-500 mt-1">创建你的账号</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">昵称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="nickname"
              placeholder="怎么称呼你"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white focus:border-tomato-400 outline-none transition"
            />
          </div>
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
              minLength={6}
              autoComplete="new-password"
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
            {loading ? "创建中…" : "创建账号"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-5">
          已有账号？{" "}
          <Link href="/tomato/login/" className="text-tomato-600 hover:text-tomato-700 font-medium">
            登录
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
