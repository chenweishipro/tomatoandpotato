"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, Play, RotateCcw, Trash2, Edit3,
  AlertTriangle, CalendarDays, Clock, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownView } from "@/components/markdown-editor";
import type { Todo } from "@/components/todo-list";

const PRIORITY_COLORS: Record<number, { dot: string; text: string; label: string }> = {
  0: { dot: "bg-tomato-500", text: "text-tomato-700", label: "P0" },
  1: { dot: "bg-orange-500", text: "text-orange-700", label: "P1" },
  2: { dot: "bg-gray-400", text: "text-gray-600 dark:text-gray-400 dark:text-gray-500", label: "P2" },
};

type Quadrant = "Q1" | "Q2" | "Q3" | "Q4";

const QUADRANT_META: Record<Quadrant, {
  title: string;
  subtitle: string;
  headerBg: string;
  borderColor: string;
  icon: string;
  advice: string;
}> = {
  Q1: {
    title: "重要 + 紧急",
    subtitle: "Do First · 立即做",
    headerBg: "bg-tomato-50",
    borderColor: "border-tomato-200",
    icon: "🚨",
    advice: "亲自做，今天就处理",
  },
  Q2: {
    title: "重要 + 不紧急",
    subtitle: "Schedule · 计划做",
    headerBg: "bg-blue-50",
    borderColor: "border-blue-200",
    icon: "📅",
    advice: "排进日程，预留专注时间",
  },
  Q3: {
    title: "不重要 + 紧急",
    subtitle: "Delegate · 委托",
    headerBg: "bg-amber-50",
    borderColor: "border-amber-200",
    icon: "🤝",
    advice: "能委派就委派，快速脱手",
  },
  Q4: {
    title: "不重要 + 不紧急",
    subtitle: "Defer · 延后 / 删除",
    headerBg: "bg-gray-50 dark:bg-slate-800",
    borderColor: "border-gray-200 dark:border-slate-700",
    icon: "🗑️",
    advice: "考虑删掉或挪到空余时间",
  },
};

/**
 * 四象限分组 + 排序
 * 规则：
 *  - Q1 (重要+紧急): P0 + (deadline 已过期 OR deadline <= 3 天)
 *  - Q2 (重要+不紧急): P0 + deadline > 3 天
 *  - Q3 (不重要+紧急): P1/P2 + (deadline 已过期 OR deadline <= 3 天)
 *  - Q4 (不重要+不紧急): P1/P2 + (deadline > 3 天 OR 无 deadline)
 * 排序：deadline asc → priority asc → estimatedPomodoros asc
 */
function classify(todo: Todo): Quadrant {
  const isImportant = todo.priority === 0;
  const now = Date.now();
  let isUrgent = false;
  if (todo.deadline) {
    const dl = new Date(todo.deadline).getTime();
    const daysLeft = (dl - now) / (1000 * 60 * 60 * 24);
    isUrgent = daysLeft <= 3;
  } else {
    // P0 无 deadline 也算"紧急"（要尽快排期）
    isUrgent = todo.priority === 0;
  }
  if (isImportant && isUrgent) return "Q1";
  if (isImportant && !isUrgent) return "Q2";
  if (!isImportant && isUrgent) return "Q3";
  return "Q4";
}

function sortTodos(list: Todo[]): Todo[] {
  return [...list].sort((a, b) => {
    // 1) deadline 升序（无 deadline 排最后）
    const aDl = a.deadline ? new Date(a.deadline).getTime() : Infinity;
    const bDl = b.deadline ? new Date(b.deadline).getTime() : Infinity;
    if (aDl !== bDl) return aDl - bDl;
    // 2) priority 升序 (P0 优先)
    if (a.priority !== b.priority) return a.priority - b.priority;
    // 3) estimatedPomodoros 升序
    const aEst = a.estimatedPomodoros ?? Infinity;
    const bEst = b.estimatedPomodoros ?? Infinity;
    return aEst - bEst;
  });
}

type Props = {
  todos: Todo[];
  onSetStatus: (id: string, status: string) => void;
  onSetPriority: (id: string, priority: number) => void;
  onRemove: (id: string) => void;
  onEdit: (todo: Todo) => void;
  onSetActive: (id: string | null) => void;
  activeTodoId: string | null;
};

export function QuadrantView({
  todos,
  onSetStatus,
  onSetPriority,
  onRemove,
  onEdit,
  onSetActive,
  activeTodoId,
}: Props) {
  const groups = useMemo(() => {
    const activeTodos = todos.filter((t) => t.status !== "done" && t.status !== "archived");
    const buckets: Record<Quadrant, Todo[]> = { Q1: [], Q2: [], Q3: [], Q4: [] };
    for (const t of activeTodos) {
      buckets[classify(t)].push(t);
    }
    return {
      Q1: sortTodos(buckets.Q1),
      Q2: sortTodos(buckets.Q2),
      Q3: sortTodos(buckets.Q3),
      Q4: sortTodos(buckets.Q4),
    };
  }, [todos]);

  return (
    <div className="space-y-3">
      {/* 提示条 */}
      <div className="bg-gradient-to-r from-tomato-50 via-blue-50 to-amber-50 rounded-2xl p-3 border border-gray-100 dark:border-slate-700">
        <div className="text-xs text-gray-600 dark:text-gray-400 dark:text-gray-500 flex items-center gap-1.5 flex-wrap">
          <span>📐</span>
          <span>艾森豪威尔矩阵：按</span>
          <strong className="text-gray-800 dark:text-gray-200">重要性</strong>
          <span>+</span>
          <strong className="text-gray-800 dark:text-gray-200">截止时间</strong>
          <span>+</span>
          <strong className="text-gray-800 dark:text-gray-200">预计番茄数</strong>
          <span>自动排序</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <QuadrantCard
          quadrant="Q1"
          todos={groups.Q1}
          onSetStatus={onSetStatus}
          onSetPriority={onSetPriority}
          onRemove={onRemove}
          onEdit={onEdit}
          onSetActive={onSetActive}
          activeTodoId={activeTodoId}
        />
        <QuadrantCard
          quadrant="Q2"
          todos={groups.Q2}
          onSetStatus={onSetStatus}
          onSetPriority={onSetPriority}
          onRemove={onRemove}
          onEdit={onEdit}
          onSetActive={onSetActive}
          activeTodoId={activeTodoId}
        />
        <QuadrantCard
          quadrant="Q3"
          todos={groups.Q3}
          onSetStatus={onSetStatus}
          onSetPriority={onSetPriority}
          onRemove={onRemove}
          onEdit={onEdit}
          onSetActive={onSetActive}
          activeTodoId={activeTodoId}
        />
        <QuadrantCard
          quadrant="Q4"
          todos={groups.Q4}
          onSetStatus={onSetStatus}
          onSetPriority={onSetPriority}
          onRemove={onRemove}
          onEdit={onEdit}
          onSetActive={onSetActive}
          activeTodoId={activeTodoId}
        />
      </div>
    </div>
  );
}

function QuadrantCard({
  quadrant,
  todos,
  onSetStatus,
  onSetPriority,
  onRemove,
  onEdit,
  onSetActive,
  activeTodoId,
}: {
  quadrant: Quadrant;
  todos: Todo[];
  onSetStatus: (id: string, status: string) => void;
  onSetPriority: (id: string, priority: number) => void;
  onRemove: (id: string) => void;
  onEdit: (todo: Todo) => void;
  onSetActive: (id: string | null) => void;
  activeTodoId: string | null;
}) {
  const meta = QUADRANT_META[quadrant];
  return (
    <div className={cn("rounded-2xl border bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm overflow-hidden", meta.borderColor)}>
      <div className={cn("px-4 py-2.5 border-b", meta.headerBg, meta.borderColor)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-base">{meta.icon}</span>
            <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">{meta.title}</h3>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-500">· {meta.subtitle}</span>
          </div>
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400 dark:text-gray-500 bg-white/70 px-2 py-0.5 rounded-full">
            {todos.length}
          </span>
        </div>
        <p className="text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-0.5">{meta.advice}</p>
      </div>
      <div className="p-2 min-h-[120px] max-h-[280px] overflow-y-auto space-y-1.5">
        {todos.length === 0 ? (
          <div className="text-center py-6 text-xs text-gray-400 dark:text-gray-500">暂无任务</div>
        ) : (
          <AnimatePresence>
            {todos.map((t) => (
              <QuadrantItem
                key={t.id}
                todo={t}
                isActive={activeTodoId === t.id}
                onSetStatus={onSetStatus}
                onSetPriority={onSetPriority}
                onRemove={onRemove}
                onEdit={onEdit}
                onSetActive={onSetActive}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

function QuadrantItem({
  todo,
  isActive,
  onSetStatus,
  onSetPriority,
  onRemove,
  onEdit,
  onSetActive,
}: {
  todo: Todo;
  isActive: boolean;
  onSetStatus: (id: string, status: string) => void;
  onSetPriority: (id: string, priority: number) => void;
  onRemove: (id: string) => void;
  onEdit: (todo: Todo) => void;
  onSetActive: (id: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const p = PRIORITY_COLORS[todo.priority] ?? PRIORITY_COLORS[1];
  const hasDescription = !!(todo.description && todo.description.trim());
  const isOverdue =
    todo.deadline && new Date(todo.deadline).getTime() < Date.now();

  // deadline 距离天数
  const daysLeft = todo.deadline
    ? Math.ceil((new Date(todo.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={cn(
        "group rounded-lg border transition",
        isActive ? "bg-tomato-50 border-tomato-200" : "bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-700 hover:border-gray-200 dark:hover:border-slate-600 dark:border-slate-700"
      )}
    >
      <div className="flex items-center gap-1.5 p-2">
        <button
          onClick={() => onSetStatus(todo.id, "done")}
          className="shrink-0 w-4 h-4 rounded border-2 border-gray-300 dark:border-slate-600 hover:border-tomato-400 transition"
          aria-label="完成"
        />
        <button
          onClick={() => {
            const next = (todo.priority + 1) % 3;
            onSetPriority(todo.id, next);
          }}
          className={cn("shrink-0 w-1.5 h-1.5 rounded-full", p.dot)}
          title={`${p.label}`}
        />
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => hasDescription && setExpanded(!expanded)}
        >
          <p className="text-xs text-gray-800 dark:text-gray-200 leading-tight">
            {todo.title}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-500">
            {todo.deadline && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5",
                  isOverdue ? "text-tomato-600 font-medium" : daysLeft !== null && daysLeft <= 3 ? "text-orange-600" : "text-gray-500 dark:text-gray-400 dark:text-gray-500"
                )}
              >
                <CalendarDays size={9} />
                {isOverdue
                  ? `已逾期 ${Math.abs(daysLeft!)}天`
                  : daysLeft === 0
                  ? "今天"
                  : daysLeft === 1
                  ? "明天"
                  : `${daysLeft}天后`}
              </span>
            )}
            {todo.estimatedPomodoros != null && (
              <span className="inline-flex items-center gap-0.5">
                🍅 ×{todo.estimatedPomodoros}
              </span>
            )}
            {(todo.pomodoroCount ?? 0) > 0 && (
              <span className="text-tomato-500">已 {todo.pomodoroCount}</span>
            )}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
          <button
            onClick={onEdit.bind(null, todo)}
            className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 dark:text-gray-300 rounded transition"
            title="编辑"
          >
            <Edit3 size={11} />
          </button>
          <button
            onClick={() => {
              if (todo.status === "todo") onSetStatus(todo.id, "doing");
              onSetActive(isActive ? null : todo.id);
            }}
            className={cn(
              "p-1 rounded transition",
              isActive
                ? "bg-tomato-200 text-tomato-700"
                : "text-gray-400 dark:text-gray-500 hover:text-tomato-600"
            )}
            title="用这个任务专注"
          >
            {isActive ? <RotateCcw size={11} /> : <Play size={11} />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {expanded && hasDescription && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-2.5 pb-2 pt-1 border-t border-gray-100 dark:border-slate-700">
              <MarkdownView content={todo.description!} compact />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
