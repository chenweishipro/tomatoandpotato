"use client";

import { useEffect, useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">加载中…</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) setError("链接无效, 请重新申请");
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("密码至少 6 位");
      return;
    }
    if (password !== confirm) {
      setError("两次密码不一致");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();
      if (res.ok) {
        setDone(true);
        // 2s 后跳 login
        setTimeout(() => router.push("/login/"), 2000);
      } else {
        setError(data.error || "重置失败");
      }
    } catch {
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
              <h2 className="text-lg font-semibold text-gray-900 mb-2">重置密码</h2>
              <p className="text-sm text-gray-500 mb-5">设置新密码以登录你的账号。</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="新密码（至少 6 位）"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-tomato-400 focus:ring-2 focus:ring-tomato-100 outline-none"
                />
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="确认新密码"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-tomato-400 focus:ring-2 focus:ring-tomato-100 outline-none"
                />
                {error && <p className="text-sm text-red-500">{error}</p>}
                <button
                  type="submit"
                  disabled={loading || !token}
                  className="w-full py-3 bg-tomato-500 hover:bg-tomato-600 disabled:bg-gray-300 text-white font-medium rounded-xl transition"
                >
                  {loading ? "重置中..." : "重置密码"}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-2">
              <div className="text-3xl mb-3">✅</div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">密码已重置</h2>
              <p className="text-sm text-gray-500">2 秒后跳转到登录页...</p>
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
