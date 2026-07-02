"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { PomodoroTimer } from "@/components/pomodoro-timer";
import { TodoList, type Todo } from "@/components/todo-list";
import { apiFetch } from "@/lib/api-client";

type Settings = {
  focusMinutes: number;
  shortBreakMin: number;
  longBreakMin: number;
  pomosBeforeLong: number;
  autoStartBreak: boolean;
  soundEnabled: boolean;
};

export default function AppPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [activeTodoId, setActiveTodoId] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [focusCount, setFocusCount] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mobileTab, setMobileTab] = useState<"timer" | "todos">("timer");

  const loadTodos = useCallback(async () => {
    const res = await apiFetch("/api/todos");
    if (res.ok) {
      const data = await res.json();
      setTodos(data.todos);
    }
  }, []);

  const loadStats = useCallback(async () => {
    const res = await apiFetch("/api/stats/today");
    if (res.ok) {
      const data = await res.json();
      setFocusCount(data.focusCount);
      setTodayCount(data.focusCount);
      setTodayMinutes(data.focusMinutes ?? 0);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 5s 超时 fallback: 即使 fetch 挂住, 也别永远"加载中"
      const timer = setTimeout(() => {
        if (!cancelled) {
          setSettings({
            focusMinutes: 25,
            shortBreakMin: 5,
            longBreakMin: 15,
            pomosBeforeLong: 4,
            autoStartBreak: true,
            soundEnabled: true,
          });
          setLoading(false);
        }
      }, 5000);

      try {
        const settingsRes = await apiFetch("/api/settings");
        if (cancelled) return;
        if (settingsRes.ok) {
          const s = await settingsRes.json();
          setSettings(s);
        }
        await Promise.all([loadTodos(), loadStats()]);
      } catch {
        // 忽略: timer 会兜底
      } finally {
        if (!cancelled) {
          clearTimeout(timer);
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [loadTodos, loadStats]);

  // 持久化 activeTodoId
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("activeTodoId");
    if (saved) setActiveTodoId(saved);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (activeTodoId) localStorage.setItem("activeTodoId", activeTodoId);
    else localStorage.removeItem("activeTodoId");
  }, [activeTodoId]);

  // 快捷键: Space/R/1/2/3/4/Esc
  useEffect(() => {
    if (typeof window === "undefined") return;
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      // 在 input/textarea/contenteditable 里不拦截, 避免干扰用户输入
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.code === "Space") {
        e.preventDefault();
        // 通过自定义事件传递给 pomodoro-timer (组件内部有 running/paused 状态)
        window.dispatchEvent(new CustomEvent("tomato:toggle"));
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("tomato:reset"));
      } else if (e.key === "1") setMobileTab("timer");
      else if (e.key === "2") setMobileTab("todos");
      else if (e.key === "3") window.location.href = "/carrot/app/stats";
      else if (e.key === "4") window.location.href = "/carrot/app/history";
      else if (e.key === "Escape") window.dispatchEvent(new CustomEvent("tomato:abandon"));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">
        加载中…
      </div>
    );
  }

  const activeTodo = todos.find((t) => t.id === activeTodoId) ?? null;

  return (
    <>
      {/* 移动端 tab 切换 */}
      <div className="sm:hidden flex gap-1 p-1 bg-gray-100 dark:bg-slate-800/80 rounded-full mb-4 w-fit mx-auto">
        <button
          onClick={() => setMobileTab("timer")}
          className={
            "px-5 py-1.5 text-sm font-medium rounded-full transition " +
            (mobileTab === "timer"
              ? "bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 shadow-sm"
              : "text-gray-500 dark:text-gray-400 dark:text-gray-500")
          }
        >
          🍅 番茄
        </button>
        <button
          onClick={() => setMobileTab("todos")}
          className={
            "px-5 py-1.5 text-sm font-medium rounded-full transition " +
            (mobileTab === "todos"
              ? "bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 shadow-sm"
              : "text-gray-500 dark:text-gray-400 dark:text-gray-500")
          }
        >
          ✅ 任务 {todos.filter((t) => t.status !== "done" && t.status !== "archived").length > 0 &&
            `(${todos.filter((t) => t.status !== "done" && t.status !== "archived").length})`}
        </button>
      </div>

      {/* 桌面端今日进度卡片 (移动端 tab 切换隐藏) */}
      <div className="hidden lg:grid grid-cols-3 gap-3 mb-1">
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-tomato-50 to-orange-50 dark:from-slate-800 dark:to-slate-800 rounded-2xl p-4 border border-tomato-100 dark:border-slate-700"
        >
          <div className="text-[10px] uppercase tracking-wider text-tomato-600 dark:text-tomato-400 font-medium">今日番茄</div>
          <div className="text-3xl font-bold text-tomato-700 dark:text-tomato-300 tabular-nums mt-1">{todayCount}</div>
          <div className="text-xs text-tomato-500/80 dark:text-tomato-400/80 mt-0.5">🍅 完成</div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-gradient-to-br from-tomato-50 to-orange-50 dark:from-slate-800 dark:to-slate-800 rounded-2xl p-4 border border-tomato-100 dark:border-slate-700"
        >
          <div className="text-[10px] uppercase tracking-wider text-tomato-600 dark:text-tomato-400 font-medium">今日专注</div>
          <div className="text-3xl font-bold text-tomato-700 dark:text-tomato-300 tabular-nums mt-1">{todayMinutes}</div>
          <div className="text-xs text-tomato-500/80 dark:text-tomato-400/80 mt-0.5">分钟</div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-tomato-50 to-orange-50 dark:from-slate-800 dark:to-slate-800 rounded-2xl p-4 border border-tomato-100 dark:border-slate-700"
        >
          <div className="text-[10px] uppercase tracking-wider text-tomato-600 dark:text-tomato-400 font-medium">待办任务</div>
          <div className="text-3xl font-bold text-tomato-700 dark:text-tomato-300 tabular-nums mt-1">
            {todos.filter((t) => t.status !== "done" && t.status !== "archived").length}
          </div>
          <div className="text-xs text-tomato-500/80 dark:text-tomato-400/80 mt-0.5">📝 未完成</div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-5">
        <div className={mobileTab === "timer" ? "block" : "hidden sm:block"}>
          <PomodoroTimer
            settings={settings}
            activeTodo={activeTodo ? { id: activeTodo.id, title: activeTodo.title } : null}
            focusCount={focusCount}
            onClearActiveTodo={() => setActiveTodoId(null)}
            onPomodoroCompleted={() => loadStats()}
          />
        </div>
        <div className={mobileTab === "todos" ? "block" : "hidden sm:block"}>
          <TodoList
            todos={todos}
            activeTodoId={activeTodoId}
            onSetActive={setActiveTodoId}
            onRefresh={loadTodos}
          />
        </div>
      </div>
    </>
  );
}
