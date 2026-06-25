"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [mode, setMode] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setDone(true);
        setMode(data.mode || "");
      } else {
        setError(data.error || "发送失败");
      }
    } catch (e) {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-tomato-50 via-white to-orange-50 px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center mb-8 gap-2">
          <span className="text-3xl">🍅</span>
          <h1 className="text-2xl font-semibold text-gray-900">番茄土豆</h1>
        </div>

        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6">
          {!done ? (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">找回密码</h2>
              <p className="text-sm text-gray-500 mb-5">
                输入注册邮箱, 我们会发送重置链接给你。
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  type="email"
                  required
                  placeholder="邮箱"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-tomato-400 focus:ring-2 focus:ring-tomato-100 outline-none"
                />
                {error && <p className="text-sm text-red-500">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-tomato-500 hover:bg-tomato-600 disabled:bg-gray-300 text-white font-medium rounded-xl transition"
                >
                  {loading ? "发送中..." : "发送重置链接"}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-2">
              <div className="text-3xl mb-3">📬</div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">邮件已发送</h2>
              <p className="text-sm text-gray-500 mb-3">
                如果该邮箱已注册, 重置链接已发出。
                请检查邮箱（含垃圾邮件）。
              </p>
              {mode === "log" && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2 mt-3">
                  ⚠️ 邮件服务未配置, 链接已写入服务器日志 <code>/tmp/tomato-reset-emails.log</code>。
                  <br />
                  生产环境请配置 SMTP 环境变量。
                </p>
              )}
            </div>
          )}
        </div>

        <div className="text-center mt-4">
          <Link href="/login/" className="text-sm text-tomato-600 hover:underline">
            ← 返回登录
          </Link>
        </div>
      </div>
    </div>
  );
}
