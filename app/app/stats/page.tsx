"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { startOfDay } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { useT } from "@/lib/i18n";
import { DayDetailModal } from "@/components/day-detail-modal";

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
 * 番茄数 → 明暗色阶
 * 6 档从浅到深：gray(0) → tomato-100 → 200 → 300 → 400 → 500 → 600
 * 用 log scale 避免"就一个番茄"直接跳最深色，1 番茄、2 番茄、3+ 都有明显明暗区分
 * max=0 退化到全 0（不会触发）
 */
function cellColor(c: number, max: number): string {
  if (c === 0) return "bg-gray-100";
  if (max <= 1) return "bg-tomato-200";  // 只有 1 个有数据时，直接浅红
  // log scale: ratio = log(c+1) / log(max+1), 均匀分布到 0-1
  const ratio = Math.log(c + 1) / Math.log(max + 1);
  if (ratio < 0.2)  return "bg-tomato-100";
  if (ratio < 0.4)  return "bg-tomato-200";
  if (ratio < 0.6)  return "bg-tomato-300";
  if (ratio < 0.8)  return "bg-tomato-400";
  if (ratio < 0.95) return "bg-tomato-500";
  return "bg-tomato-600";
}

export default function StatsPage() {
  const { t } = useT();
  const [today, setToday] = useState<{ focusCount: number; focusMinutes: number; todosDone: number } | null>(null);
  const [week, setWeek] = useState<Week[]>([]);
  const [month, setMonth] = useState<Month | null>(null);
  const [heatmap, setHeatmap] = useState<Heatmap | null>(null);
  const [loading, setLoading] = useState(true);

  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

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

  if (loading) return <div className="text-center text-gray-400 py-20">{t("common.loading")}</div>;

  const weekTotal = week.reduce((s, d) => s + d.count, 0);
  const weekMinutes = week.reduce((s, d) => s + d.minutes, 0);
  const monthTotal = month ? Object.values(month.days).reduce((s, n) => s + n, 0) : 0;
  const yearTotal = heatmap ? Object.values(heatmap.days).reduce((s, n) => s + n, 0) : 0;
  const yearMinutes = today?.focusMinutes ? Math.round((yearTotal * 25)) : 0; // 粗略

  return (
    <div className="space-y-5">
      {/* 4 卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label={t("stats.today")} value={String(today?.focusCount ?? 0)} suffix="🍅" />
        <StatCard label={t("stats.todayFocus")} value={String(today?.focusMinutes ?? 0)} suffix={t("settings.minutes")} />
        <StatCard label={t("stats.weekTotal")} value={String(weekTotal)} suffix="🍅" />
        <StatCard label={t("stats.monthTotal")} value={String(monthTotal)} suffix="🍅" />
      </div>

      {/* 周 */}
      <HeatmapSection
        title={`📅 ${t("stats.week")}`}
        rightSlot={<span className="text-xs text-gray-500">共 {weekTotal} 🍅 · {weekMinutes} 分钟</span>}
      >
        <WeekHeatmap week={week} onCellClick={setSelectedDate} />
      </HeatmapSection>

      {/* 月 */}
      <HeatmapSection
        title={`🗓️ ${t("stats.month")}`}
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
        <MonthHeatmap year={viewYear} month={viewMonth} days={month?.days ?? {}} onCellClick={setSelectedDate} />
      </HeatmapSection>

      {/* 年 */}
      <HeatmapSection
        title={`🌳 ${t("stats.year")}`}
        rightSlot={<span className="text-xs text-gray-500">共 {yearTotal} 🍅</span>}
      >
        <YearHeatmap year={heatmap?.year ?? viewYear} days={heatmap?.days ?? {}} onCellClick={setSelectedDate} />
      </HeatmapSection>

      <Legend />

      <DayDetailModal date={selectedDate} onClose={() => setSelectedDate(null)} />
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
function WeekHeatmap({ week, onCellClick }: { week: Week[]; onCellClick: (date: string) => void }) {
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
                onClick={() => dt && dayData.count > 0 && onCellClick(dt.toISOString().slice(0, 10))}
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
  onCellClick,
}: {
  year: number;
  month: number;
  days: Record<string, number>;
  onCellClick: (date: string) => void;
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
                onClick={() => cell.count > 0 && onCellClick(cell.key)}
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
 * 年：GitHub 风格 53 周 × 7 天，顶部月份分隔标签
 * 每个 1 号从当月第一天所在的星期几位置开始（自动对齐）
 * 总计 365/366 个格子全显示
 */
function YearHeatmap({
  year,
  days,
  onCellClick,
}: {
  year: number;
  days: Record<string, number>;
  onCellClick: (date: string) => void;
}) {
  // 1. 生成一年所有日期，Mon=0..Sun=6
  const allDates: { date: Date; key: string; count: number }[] = [];
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    allDates.push({ date: new Date(d), key, count: days[key] ?? 0 });
  }

  // 2. 按周分块: 每周一作为新列起点 (如果 1/1 是周三，则第 1 周有 Wed/Thu/Fri/Sat/Sun 5 格，前面 3 格空)
  const firstDay = startDate.getDay();
  const firstDayIdx = (firstDay + 6) % 7; // Mon=0
  const padded: ({ date: Date; key: string; count: number } | null)[] = [
    ...Array(firstDayIdx).fill(null),
    ...allDates,
  ];
  // 补齐末尾到 7 的倍数
  while (padded.length % 7 !== 0) padded.push(null);

  const weeks: (typeof padded)[] = [];
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));

  // 3. 顶部月份标签: 每月的 1 号所在周上方显示该月名
  // 完整计算: 月份标签位于该月 1 号所在周的起始位置
  // (如果要省略月份, 设置 labelWeek=该月第一天所在周)
  const monthLabelWeeks: { label: string; weekIdx: number }[] = [];
  let lastMonth = -1;
  weeks.forEach((week, wi) => {
    for (const cell of week) {
      if (!cell) continue;
      const m = cell.date.getMonth();
      if (m !== lastMonth) {
        // 第一次出现该月的位置
        monthLabelWeeks.push({ label: MONTH_LABELS_EN[m], weekIdx: wi });
        lastMonth = m;
        break;
      }
    }
  });

  const yearMax = allDates.reduce((m, c) => Math.max(m, c.count), 0);

  return (
    <div className="overflow-x-auto -mx-2 px-2 pb-1">
      <div className="w-fit mx-auto sm:mx-0">
        {/* 顶部月份标签行 — 每个标签在月份 1 号所在周上方 */}
        <div className="flex gap-0.5 pl-0 mb-1">
          {weeks.map((_, wi) => {
            const lbl = monthLabelWeeks.find((m) => m.weekIdx === wi);
            return (
              <div key={wi} className="w-3.5 text-[9px] text-gray-400 font-medium leading-none">
                {lbl ? lbl.label : ""}
              </div>
            );
          })}
        </div>
        {/* 7 行 × N 周 */}
        <div className="flex gap-0.5">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-0.5">
              {week.map((cell, ci) => {
                if (!cell) {
                  return <div key={ci} className="w-3.5 h-3.5" />;
                }
                const m = cell.date.getMonth();
                const d = cell.date.getDate();
                // 每月 1 号描边强调
                const isFirstOfMonth = d === 1;
                return (
                  <motion.div
                    key={cell.key}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: (wi * 7 + ci) * 0.001 }}
                    className={
                      "w-3.5 h-3.5 rounded-[2px] cursor-pointer transition hover:ring-1 hover:ring-tomato-400 " +
                      cellColor(cell.count, yearMax) +
                      (isFirstOfMonth ? " ring-1 ring-gray-400" : "")
                    }
                    title={`${cell.key} - ${cell.count} 🍅${isFirstOfMonth ? ` (${MONTH_NAMES[m]} 1 号)` : ""}`}
                    onClick={() => cell.count > 0 && onCellClick(cell.key)}
                  />
                );
              })}
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
  const { t } = useT();
  return (
    <div className="flex items-center justify-end gap-2 text-xs text-gray-500 px-1">
      <span>{t("stats.less")}</span>
      <div className="w-3 h-3 rounded-sm bg-gray-100" />
      <div className="w-3 h-3 rounded-sm bg-tomato-200" />
      <div className="w-3 h-3 rounded-sm bg-tomato-400" />
      <div className="w-3 h-3 rounded-sm bg-tomato-500" />
      <div className="w-3 h-3 rounded-sm bg-tomato-600" />
      <span>{t("stats.more")}</span>
    </div>
  );
}
