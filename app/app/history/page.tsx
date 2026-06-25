"use client";
import { apiFetch } from "@/lib/api-client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Coffee, Timer as TimerIcon, TreePine, FileText } from "lucide-react";
import { useT } from "@/lib/i18n";

type Item = {
  id: string;
  type: string;
  durationMin: number;
  completedAt: string;
  todo: { id: string; title: string } | null;
};

export default function HistoryPage() {
  const { t } = useT();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/pomodoros")
      .then(async (r) => {
        if (!r.ok) {
          // 401 等: 不要一直转圈, 提示错误
          setItems([]);
          setLoading(false);
          return;
        }
        const d = await r.json();
        setItems(d.pomodoros ?? []);
        setLoading(false);
      })
      .catch(() => {
        // 网络错误 / 解析错误: 也要退出 loading
        setItems([]);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="text-center text-gray-400 dark:text-gray-500 py-20">加载中…</div>;

  // 按日期分组
  const groups: Record<string, Item[]> = {};
  for (const it of items) {
    const key = format(new Date(it.completedAt), "yyyy-MM-dd");
    if (!groups[key]) groups[key] = [];
    groups[key].push(it);
  }
  const sortedKeys = Object.keys(groups).sort((a, b) => (a < b ? 1 : -1));

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">📜 番茄历史</h1>

      {items.length === 0 && (
        <div className="bg-white/80 dark:bg-slate-900/80 rounded-3xl p-12 text-center border border-gray-100 dark:border-slate-700">
          <div className="text-5xl mb-3">🌱</div>
          <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500">还没有番茄记录，去专注一个吧</p>
        </div>
      )}

      {sortedKeys.map((key) => {
        const dayItems = groups[key];
        const focusCount = dayItems.filter((i) => i.type === "focus").length;
        const focusMin = dayItems
          .filter((i) => i.type === "focus")
          .reduce((s, i) => s + i.durationMin, 0);
        return (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100 dark:border-slate-700"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {format(new Date(key), "yyyy 年 M 月 d 日 EEEE")}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
                {focusCount} 🍅 · {focusMin} 分钟
              </div>
            </div>
            <div className="space-y-1.5">
              {dayItems.map((it) => {
                const Icon =
                  it.type === "focus" ? TimerIcon : it.type === "short_break" ? Coffee : TreePine;
                const color =
                  it.type === "focus"
                    ? "text-tomato-500"
                    : it.type === "short_break"
                    ? "text-tomato-500"
                    : "text-sky-500";
                const typeLabel = it.type === "focus" ? "番茄" : it.type === "short_break" ? "短休" : "长休";
                return (
                  <div
                    key={it.id}
                    className="flex items-center gap-3 text-sm py-1.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-800/50 transition group"
                  >
                    <Icon size={14} className={color} />
                    <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 tabular-nums w-12">
                      {format(new Date(it.completedAt), "HH:mm")}
                    </span>
                    <span className="flex-1 min-w-0 text-gray-700 dark:text-gray-300 dark:text-gray-300 truncate">
                      {it.todo ? it.todo.title : <span className="text-gray-400 dark:text-gray-500 italic">纯专注</span>}
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-800 dark:bg-slate-700 tabular-nums">{typeLabel}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 tabular-nums w-10 text-right">{it.durationMin}m</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
