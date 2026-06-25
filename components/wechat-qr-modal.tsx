"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export function WechatQrModal({
  open,
  onClose,
  // 登录场景不需要传 user; 绑定场景需要传 user (回调会用 user id 写 state)
  intent = "login",
}: {
  open: boolean;
  onClose: () => void;
  intent?: "login" | "bind";
}) {
  const [qrUrl, setQrUrl] = useState<string>("");
  const [dev, setDev] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    const endpoint = intent === "bind" ? "/api/wechat/bind" : "/api/wechat/qrcode";
    fetch(endpoint)
      .then((r) => r.json())
      .then((d) => {
        setQrUrl(d.url || "");
        setDev(!!d.dev);
        setEnabled(!!d.enabled);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [open, intent]);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  function handleScan() {
    // 打开微信扫码 URL (在新窗口 or 当前窗口)
    // dev 模式: 是 /tomato/api/wechat/dev-qr, 也直接跳转
    window.location.href = qrUrl;
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-slate-700">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {intent === "bind" ? "绑定微信" : "微信登录"}
              </h3>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500"
                aria-label="关闭"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 text-center">
              {loading && <div className="py-12 text-gray-400">加载二维码…</div>}

              {!loading && error && (
                <div className="py-8 text-sm text-red-500">加载失败: {error}</div>
              )}

              {!loading && !error && qrUrl && (
                <>
                  {dev ? (
                    // Dev 模式: 点击跳转 dev-qr 页面 (那里有"模拟扫码成功"按钮)
                    <div
                      onClick={handleScan}
                      className="cursor-pointer mx-auto w-44 h-44 border-2 border-dashed border-green-400 rounded-xl flex flex-col items-center justify-center bg-green-50 dark:bg-green-950/20 hover:bg-green-100 dark:hover:bg-green-950/40 transition"
                    >
                      <div className="text-5xl mb-1">📱</div>
                      <div className="text-xs text-green-700 dark:text-green-400 font-medium">点击模拟扫码</div>
                    </div>
                  ) : (
                    // 真微信模式: 显示二维码 (用 qrcode.js 或第三方库 - 这里用占位)
                    <div
                      onClick={handleScan}
                      className="cursor-pointer mx-auto w-44 h-44 bg-gray-50 dark:bg-slate-800 rounded-xl flex flex-col items-center justify-center border border-gray-200 dark:border-slate-700 hover:border-green-400 transition"
                    >
                      <div className="text-5xl mb-1">🟢</div>
                      <div className="text-xs text-gray-500">点击打开微信扫码</div>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-4">
                    {dev
                      ? "⚠️ Dev 模式 (未配 WECHAT_APP_ID)"
                      : "使用微信扫一扫完成登录"}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {intent === "bind" ? "绑定后可用微信快速登录" : "首次微信登录将自动注册"}
                  </p>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
