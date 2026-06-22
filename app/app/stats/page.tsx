"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { startOfDay } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { apiFetch } from "@/lib/api-client";

type Week = { date: string; count: number; minutes: number };
type Month = { year: number; month: number; days: Record<string, number> };
type Heatmap = { year: number; days: Record<string, number> };

// 用完整 "周一" 而不是 "一" — "一" 字跟破折号视觉上一样，用户看着像缺数据
const WEEKDAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const MONTH_NAMES = [
  "一月", "二月", "三月", "四月", "五月", "六月",
  "七月", "八月", "九月", "十月", "十一月", "十二月",
];
// 年热力图顶部月份标签（英文 3 字符，GitHub 原生风格）
const MONTH_LABELS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/**
 * GitHub 风格热力图配色（统一 5 档，相对归一化）
 * 用 max 归一化避免数据稀疏时断层（0/125 直接到最深色没过渡）
 * max=0 时退化到绝对分档（默认浅绿 1 = 最小）
 */
function cellColor(c: number, max: number): string {
  if (c === 0) return "bg-gray-100";
  if (max === 0) return "bg-tomato-200";
  const ratio = c / max;
  if (ratio < 0.25) return "bg-tomato-200";
  if (ratio < 0.5)  return "bg-tomato-400";
  if (ratio < 0.75) return "bg-tomato-500";
  return "bg-tomato-600";
}

export default function StatsPage() {
  const [today, setToday] = useState<{ focusCount: number; focusMinutes: number; todosDone: number } | null>(null);
  const [week, setWeek] = useState<Week[]>([]);
  const [month, setMonth] = useState<Month | null>(null);
  const [heatmap, setHeatmap] = useState<Heatmap | null>(null);
  const [loading, setLoading] = useState(true);

  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth() + 1);

  useEffect(() => {
    (async () => {
      const year = new Date().getFullYear();
      const m = new Date().getMonth() + 1;
      const [t, w, mo, h] = await Promise.all([
        apiFetch("/api/stats/today").then((r) => r.json()),
        apiFetch("/api/stats/week").then((r) => r.json()),
        apiFetch(`/api/stats/month?year=${year}&month=${m}`).then((r) => r.json()),
        apiFetch(`/api/stats/heatmap?year=${year}`).then((r) => r.json()),
      ]);
      setToday(t);
      setWeek(w.days);
      setMonth(mo);
      setHeatmap(h);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    apiFetch(`/api/stats/month?year=${viewYear}&month=${viewMonth}`)
      .then((r) => r.json())
      .then(setMonth);
  }, [viewYear, viewMonth]);

  function shiftMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setViewMonth(m);
    setViewYear(y);
  }

  if (loading) return <div className="text-center text-gray-400 py-20">加载中…</div>;

  const weekTotal = week.reduce((s, d) => s + d.count, 0);
  const weekMinutes = week.reduce((s, d) => s + d.minutes, 0);
  const monthTotal = month ? Object.values(month.days).reduce((s, n) => s + n, 0) : 0;
  const yearTotal = heatmap ? Object.values(heatmap.days).reduce((s, n) => s + n, 0) : 0;
  const yearMinutes = today?.focusMinutes ? Math.round((yearTotal * 25)) : 0; // 粗略

  return (
    <div className="space-y-5">
      {/* 4 卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="今日番茄" value={String(today?.focusCount ?? 0)} suffix="🍅" />
        <StatCard label="今日专注" value={String(today?.focusMinutes ?? 0)} suffix="分钟" />
        <StatCard label="本周番茄" value={String(weekTotal)} suffix="🍅" />
        <StatCard label="本月番茄" value={String(monthTotal)} suffix="🍅" />
      </div>

      {/* 周 */}
      <HeatmapSection
        title="📅 本周"
        rightSlot={<span className="text-xs text-gray-500">共 {weekTotal} 🍅 · {weekMinutes} 分钟</span>}
      >
        <WeekHeatmap week={week} />
      </HeatmapSection>

      {/* 月 */}
      <HeatmapSection
        title="🗓️ 本月"
        rightSlot={
          <div className="flex items-center gap-2">
            <button
              onClick={() => shiftMonth(-1)}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
              aria-label="上一月"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-gray-700 tabular-nums w-24 text-center">
              {viewYear} · {MONTH_NAMES[viewMonth - 1]}
            </span>
            <button
              onClick={() => shiftMonth(1)}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
              aria-label="下一月"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        }
      >
        <MonthHeatmap year={viewYear} month={viewMonth} days={month?.days ?? {}} />
      </HeatmapSection>

      {/* 年 */}
      <HeatmapSection
        title="🌳 全年"
        rightSlot={<span className="text-xs text-gray-500">共 {yearTotal} 🍅</span>}
      >
        <YearHeatmap year={heatmap?.year ?? viewYear} days={heatmap?.days ?? {}} />
      </HeatmapSection>

      <Legend />
    </div>
  );
}

function StatCard({ label, value, suffix }: { label: string; value: string; suffix: string }) {
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="flex items-baseline gap-1">
        <div className="text-2xl sm:text-3xl font-semibold text-gray-900 tabular-nums">
          {value}
        </div>
        <div className="text-xs text-gray-500">{suffix}</div>
      </div>
    </div>
  );
}

function HeatmapSection({
  title,
  rightSlot,
  children,
}: {
  title: string;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-5 sm:p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {rightSlot}
      </div>
      {children}
    </div>
  );
}

/**
 * 周：7 个小方块横排，下面加日期数字
 */
function WeekHeatmap({ week }: { week: Week[] }) {
  const today = startOfDay().getTime();
  const weekMax = week.reduce((m, d) => Math.max(m, d.count), 0);
  return (
    <div className="flex justify-center sm:justify-start">
      <div className="flex items-end gap-3 sm:gap-4">
        {WEEKDAY_LABELS.map((w, i) => {
          const dayData = week[i];
          const dt = dayData ? new Date(dayData.date) : null;
          const isToday = dt && startOfDay(dt).getTime() === today;
          const count = dayData?.count ?? 0;
          return (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <div className="text-[10px] text-gray-400 font-medium">{w}</div>
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                className={
                  "w-9 h-9 sm:w-10 sm:h-10 rounded-md transition cursor-pointer hover:ring-2 hover:ring-tomato-400 " +
                  cellColor(count, weekMax) +
                  (isToday ? " ring-2 ring-tomato-500 ring-offset-1 ring-offset-white" : "")
                }
                title={dt ? `${dt.toISOString().slice(0, 10)} - ${count} 🍅` : ""}
              />
              <div className="text-[10px] text-gray-500 tabular-nums">
                {dt ? dt.getDate() : ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 月：7×5/6 小方块日历
 */
function MonthHeatmap({
  year,
  month,
  days,
}: {
  year: number;
  month: number;
  days: Record<string, number>;
}) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const firstDayIdx = (firstDay + 6) % 7; // 周一为 0
  const daysInMonth = new Date(year, month, 0).getDate();

  const now = new Date();
  const todayKey =
    now.getFullYear() === year && now.getMonth() + 1 === month
      ? now.toISOString().slice(0, 10)
      : null;

  // 6 行 × 7 列
  const cells: ({ day: number; key: string; count: number } | null)[] = [];
  for (let i = 0; i < firstDayIdx; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, key, count: days[key] ?? 0 });
  }
  while (cells.length < 42) cells.push(null);

  const monthMax = Object.values(days).reduce((m, n) => Math.max(m, n), 0);

  return (
    <div className="overflow-x-auto -mx-2 px-2 pb-1">
      <div className="w-fit mx-auto sm:mx-0">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w} className="text-center text-[10px] text-gray-400 font-medium">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, i) => {
            if (!cell) return <div key={i} className="aspect-square" />;
            const isToday = cell.key === todayKey;
            return (
              <motion.div
                key={cell.key}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.003 }}
                className={
                  "w-9 h-9 sm:w-10 sm:h-10 rounded-sm transition cursor-pointer hover:ring-2 hover:ring-tomato-400 relative group " +
                  cellColor(cell.count, monthMax) +
                  (isToday ? " ring-2 ring-tomato-500 ring-offset-1 ring-offset-white" : "")
                }
                title={`${cell.key} - ${cell.count} 🍅`}
              >
                <div className="absolute inset-0 flex items-center justify-center text-[9px] text-gray-500 font-medium">
                  {cell.day}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * 年：12 月 × 7 周几 矩阵
 * 横轴 12 个月份，纵轴 7 天，每格是该月-该周几的累计番茄数
 * 紧凑看清：1）哪个月份多 2）一周哪天高/低 3）季节趋势
 */
function YearHeatmap({ year, days }: { year: number; days: Record<string, number> }) {
  // 构造 12 × 7 矩阵
  const matrix: number[][] = Array.from({ length: 12 }, () => Array(7).fill(0));
  // 每天贡献给该月该周几 (Mon=0, ..., Sun=6)
  const cellDates: string[][] = Array.from({ length: 12 }, () => Array(7).fill(0).map(() => ""));

  for (let m = 0; m < 12; m++) {
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, m, d);
      const weekday = (date.getDay() + 6) % 7; // Mon=0, ..., Sun=6
      const key = date.toISOString().slice(0, 10);
      matrix[m][weekday] += days[key] ?? 0;
      cellDates[m][weekday] = key; // 最后一个被赋值的为该月-该周几最后一天
    }
  }

  // 年内最大 count
  const yearMax = matrix.flat().reduce((m, n) => Math.max(m, n), 0);

  return (
    <div className="overflow-x-auto -mx-2 px-2 pb-1">
      <div className="w-fit mx-auto sm:mx-0">
        {/* 月份横轴 */}
        <div className="grid grid-cols-12 gap-1 mb-2">
          {MONTH_NAMES.map((m) => (
            <div key={m} className="text-center text-[10px] text-gray-400 font-medium">
              {m}
            </div>
          ))}
        </div>
        {/* 7 行（周一到周日）× 12 列 */}
        <div className="grid grid-cols-1 gap-1">
          {WEEKDAY_LABELS.map((w, wi) => (
            <div key={w} className="grid grid-cols-[3.5rem_1fr] items-center gap-2">
              <div className="text-[10px] text-gray-400 font-medium text-right">{w}</div>
              <div className="grid grid-cols-12 gap-1">
                {matrix.map((row, mi) => (
                  <motion.div
                    key={mi}
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: (wi * 12 + mi) * 0.003 }}
                    className={
                      "h-7 sm:h-8 rounded-sm cursor-pointer transition hover:ring-2 hover:ring-tomato-400 " +
                      cellColor(row[wi], yearMax)
                    }
                    title={`${year}年 ${mi + 1}月 ${w} — 累计 ${row[wi]} 🍅`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * 公共图例
 */
function Legend() {
  return (
    <div className="flex items-center justify-end gap-2 text-xs text-gray-500 px-1">
      <span>少</span>
      <div className="w-3 h-3 rounded-sm bg-gray-100" />
      <div className="w-3 h-3 rounded-sm bg-tomato-200" />
      <div className="w-3 h-3 rounded-sm bg-tomato-400" />
      <div className="w-3 h-3 rounded-sm bg-tomato-500" />
      <div className="w-3 h-3 rounded-sm bg-tomato-600" />
      <span>多</span>
    </div>
  );
}
