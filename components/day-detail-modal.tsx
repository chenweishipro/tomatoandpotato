"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { apiFetch } from "@/lib/api-client";

type Pomodoro = {
  id: string;
  type: string;
  durationMin: number;
  completedAt: string;
  todo: { id: string; title: string } | null;
};

export function DayDetailModal({
  date,
  onClose,
}: {
  date: string | null;
  onClose: () => void;
}) {
  const [pomos, setPomos] = useState<Pomodoro[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!date) return;
    setLoading(true);
    apiFetch(`/api/pomodoros?date=${date}&limit=200`)
      .then((r) => r.json())
      .then((d) => setPomos(d.pomodoros ?? []))
      .catch(() => setPomos([]))
      .finally(() => setLoading(false));
  }, [date]);

  // ESC 关闭
  useEffect(() => {
    if (!date) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [date, onClose]);

  const focusCount = pomos.filter((p) => p.type === "focus").length;
  const focusMin = pomos.filter((p) => p.type === "focus").reduce((s, p) => s + p.durationMin, 0);

  return (
    <AnimatePresence>
      {date && (
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
            className="bg-white dark:bg-slate-900 dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-slate-700 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">📅 {date}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-0.5">
                  {focusCount} 🍅 · {focusMin} 分钟专注
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-800 text-gray-500 dark:text-gray-400 dark:text-gray-500"
                aria-label="关闭"
              >
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto p-5 space-y-2">
              {loading && <div className="text-center text-gray-400 dark:text-gray-500 py-8">加载中…</div>}
              {!loading && pomos.length === 0 && (
                <div className="text-center text-gray-400 dark:text-gray-500 py-8">当天没有番茄记录 🍅</div>
              )}
              {!loading &&
                pomos.map((p) => {
                  const time = new Date(p.completedAt).toLocaleTimeString("zh-CN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const isFocus = p.type === "focus";
                  const label = isFocus ? "🍅" : p.type === "short_break" ? "☕" : "🛌";
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-800 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-800 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xl">{label}</span>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100 truncate">
                            {p.todo?.title ?? (
                              <span className="text-gray-400 dark:text-gray-500 italic">未关联任务</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                            {time} · {p.durationMin} 分钟
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
