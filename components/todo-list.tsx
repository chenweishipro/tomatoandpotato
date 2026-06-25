"use client";
import { apiFetch } from "@/lib/api-client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Check, Trash2, Play, RotateCcw, ChevronDown, ChevronUp, Edit3, X, LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownEditor, MarkdownView } from "@/components/markdown-editor";
import { QuadrantView } from "@/components/quadrant-view";

export type Todo = {
  id: string;
  title: string;
  description?: string | null;
  priority: number; // 0=P0, 1=P1, 2=P2
  status: string; // todo / doing / done / archived
  tags?: string | null;
  pomodoroCount?: number;
  deadline?: string | null;
  estimatedPomodoros?: number | null;
  createdAt: string;
};

/** 把 ISO 时间字符串转换为 datetime-local input 用的 "YYYY-MM-DDTHH:mm" 格式 */
function toLocalDatetime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Props = {
  todos: Todo[];
  activeTodoId: string | null;
  onSetActive: (id: string | null) => void;
  onRefresh: () => void;
};

const PRIORITY_COLORS: Record<number, { bg: string; dot: string; text: string; label: string }> = {
  0: { bg: "bg-tomato-50", dot: "bg-tomato-500", text: "text-tomato-700", label: "P0" },
  1: { bg: "bg-orange-50", dot: "bg-orange-500", text: "text-orange-700", label: "P1" },
  2: { bg: "bg-gray-100 dark:bg-slate-800", dot: "bg-gray-400", text: "text-gray-600 dark:text-gray-400 dark:text-gray-500", label: "P2" },
};

export function TodoList({ todos, activeTodoId, onSetActive, onRefresh }: Props) {
  const [view, setView] = useState<"list" | "quadrant">("list");
  const [showDone, setShowDone] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const active = todos.filter((t) => t.status === "doing");
  const todoItems = todos.filter((t) => t.status === "todo");
  const done = todos.filter((t) => t.status === "done");

  async function setStatus(id: string, status: string) {
    await apiFetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    onRefresh();
  }

  async function setPriority(id: string, priority: number) {
    await apiFetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority }),
    });
    onRefresh();
  }

  async function removeTodo(id: string) {
    if (!confirm("确定删除？")) return;
    await apiFetch(`/api/todos/${id}`, { method: "DELETE" });
    onRefresh();
  }

  return (
    <>
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-3xl p-5 sm:p-6 shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col h-full">
        <div className="flex items-center justify-between mb-4 gap-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">📝 任务</h2>
          <div className="flex items-center gap-1">
            {/* 视图切换 */}
            <div className="flex bg-gray-100 dark:bg-slate-800/80 rounded-lg p-0.5">
              <button
                onClick={() => setView("list")}
                className={cn(
                  "p-1.5 rounded-md transition",
                  view === "list" ? "bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 shadow-sm" : "text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 dark:text-gray-300"
                )}
                title="列表视图"
              >
                <List size={14} />
              </button>
              <button
                onClick={() => setView("quadrant")}
                className={cn(
                  "p-1.5 rounded-md transition",
                  view === "quadrant" ? "bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 shadow-sm" : "text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 dark:text-gray-300"
                )}
                title="四象限视图"
              >
                <LayoutGrid size={14} />
              </button>
            </div>
            <button
              onClick={() => setIsCreating(true)}
              className="text-xs px-2.5 py-1 bg-tomato-500 hover:bg-tomato-600 text-white rounded-lg transition active:scale-95 flex items-center gap-1"
            >
              <Plus size={14} /> 新建
            </button>
          </div>
        </div>

        {view === "list" ? (
          <>
            {/* 列表 */}
            <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-2 max-h-[60vh]">
          {active.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-tomato-600 uppercase tracking-wider mb-1.5 px-1">
                进行中
              </h3>
              <AnimatePresence>
                {active.map((t) => (
                  <TodoCard
                    key={t.id}
                    todo={t}
                    isActive={activeTodoId === t.id}
                    onSetActive={onSetActive}
                    onSetStatus={setStatus}
                    onSetPriority={setPriority}
                    onRemove={removeTodo}
                    onEdit={() => setEditingTodo(t)}
                  />
                ))}
              </AnimatePresence>
            </section>
          )}

          {todoItems.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5 px-1">
                待办 ({todoItems.length})
              </h3>
              <AnimatePresence>
                {todoItems.map((t) => (
                  <TodoCard
                    key={t.id}
                    todo={t}
                    isActive={activeTodoId === t.id}
                    onSetActive={onSetActive}
                    onSetStatus={setStatus}
                    onSetPriority={setPriority}
                    onRemove={removeTodo}
                    onEdit={() => setEditingTodo(t)}
                  />
                ))}
              </AnimatePresence>
            </section>
          )}

          {done.length > 0 && (
            <section>
              <button
                onClick={() => setShowDone(!showDone)}
                className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5 px-1 hover:text-gray-600 dark:hover:text-gray-300 dark:text-gray-400 dark:text-gray-500"
              >
                已完成 ({done.length}) {showDone ? "▾" : "▸"}
              </button>
              <AnimatePresence>
                {showDone &&
                  done.map((t) => (
                    <TodoCard
                      key={t.id}
                      todo={t}
                      isActive={false}
                      onSetActive={onSetActive}
                      onSetStatus={setStatus}
                      onSetPriority={setPriority}
                      onRemove={removeTodo}
                      onEdit={() => setEditingTodo(t)}
                    />
                  ))}
              </AnimatePresence>
            </section>
          )}

          {todos.length === 0 && (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <div className="text-4xl mb-2">🌱</div>
              <p className="text-sm">还没有任务，点右上角"新建"开始</p>
            </div>
          )}
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto max-h-[60vh]">
            <QuadrantView
              todos={todos}
              activeTodoId={activeTodoId}
              onSetActive={onSetActive}
              onSetStatus={setStatus}
              onSetPriority={setPriority}
              onRemove={removeTodo}
              onEdit={(t) => setEditingTodo(t)}
            />
          </div>
        )}
      </div>

      {/* 详情/编辑模态框 */}
      <AnimatePresence>
        {(editingTodo || isCreating) && (
          <TodoDetailModal
            todo={editingTodo}
            onClose={() => {
              setEditingTodo(null);
              setIsCreating(false);
            }}
            onSaved={() => {
              setEditingTodo(null);
              setIsCreating(false);
              onRefresh();
            }}
            onDeleted={() => {
              setEditingTodo(null);
              onRefresh();
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function TodoCard({
  todo,
  isActive,
  onSetActive,
  onSetStatus,
  onSetPriority,
  onRemove,
  onEdit,
}: {
  todo: Todo;
  isActive: boolean;
  onSetActive: (id: string | null) => void;
  onSetStatus: (id: string, status: string) => void;
  onSetPriority: (id: string, priority: number) => void;
  onRemove: (id: string) => void;
  onEdit: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const p = PRIORITY_COLORS[todo.priority] ?? PRIORITY_COLORS[1];
  const isDone = todo.status === "done";
  const hasDescription = !!(todo.description && todo.description.trim());

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={cn(
        "group rounded-xl border transition",
        isActive
          ? "bg-tomato-50 border-tomato-200"
          : isDone
          ? "bg-gray-50 dark:bg-slate-800 border-gray-100 dark:border-slate-700"
          : "bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-700 hover:border-gray-200 dark:hover:border-slate-600 dark:border-slate-700"
      )}
    >
      <div className="flex items-center gap-2 p-2.5">
        {/* 完成按钮 */}
        <button
          onClick={() => onSetStatus(todo.id, isDone ? "todo" : "done")}
          className={cn(
            "shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition",
            isDone
              ? "bg-tomato-500 border-tomato-500 text-white"
              : "border-gray-300 dark:border-slate-600 hover:border-tomato-400"
          )}
          aria-label="完成"
        >
          {isDone && <Check size={12} strokeWidth={3} />}
        </button>

        {/* 优先级色点 */}
        <button
          onClick={() => {
            const next = (todo.priority + 1) % 3;
            onSetPriority(todo.id, next);
          }}
          className={cn("shrink-0 w-2 h-2 rounded-full", p.dot)}
          title={`点击切换优先级 (${p.label})`}
        />

        {/* 标题 */}
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => hasDescription && setExpanded(!expanded)}
        >
          <p
            className={cn(
              "text-sm",
              hasDescription ? "" : "truncate",
              isDone ? "line-through text-gray-400 dark:text-gray-500" : "text-gray-800 dark:text-gray-200"
            )}
          >
            {todo.title}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {(todo.pomodoroCount ?? 0) > 0 && (
              <span className="text-[10px] text-tomato-500">🍅 × {todo.pomodoroCount}</span>
            )}
            {hasDescription && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                · {todo.description!.length} 字
              </span>
            )}
          </div>
        </div>

        {/* 展开按钮 */}
        {hasDescription && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="shrink-0 p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 dark:text-gray-400 dark:text-gray-500 rounded-md transition"
            aria-label="展开"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}

        {/* 操作按钮（hover 显示） */}
        <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          <button
            onClick={onEdit}
            className="p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 dark:bg-slate-800 hover:text-gray-700 dark:hover:text-gray-200 dark:text-gray-300 rounded-md transition"
            title="编辑"
            aria-label="编辑"
          >
            <Edit3 size={14} />
          </button>
          {!isDone && (
            <button
              onClick={() => {
                if (todo.status === "todo") onSetStatus(todo.id, "doing");
                onSetActive(isActive ? null : todo.id);
              }}
              className={cn(
                "p-1 rounded-md transition",
                isActive
                  ? "bg-tomato-200 text-tomato-700"
                  : "text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 dark:bg-slate-800 hover:text-tomato-600"
              )}
              title="用这个任务专注"
              aria-label="开始专注"
            >
              {isActive ? <RotateCcw size={14} /> : <Play size={14} />}
            </button>
          )}
          <button
            onClick={() => onRemove(todo.id)}
            className="p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 dark:bg-slate-800 hover:text-tomato-600 rounded-md transition"
            title="删除"
            aria-label="删除"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* 展开的 markdown 描述 */}
      <AnimatePresence>
        {expanded && hasDescription && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 border-t border-gray-100 dark:border-slate-700">
              <MarkdownView content={todo.description!} compact />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * Todo 详情/编辑模态框
 * 新建和编辑共用
 */
function TodoDetailModal({
  todo,
  onClose,
  onSaved,
  onDeleted,
}: {
  todo: Todo | null; // null = 新建模式
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const isEdit = !!todo;
  const [title, setTitle] = useState(todo?.title ?? "");
  const [description, setDescription] = useState(todo?.description ?? "");
  const [priority, setPriority] = useState<number>(todo?.priority ?? 1);
  const [deadline, setDeadline] = useState<string>(
    todo?.deadline ? toLocalDatetime(todo.deadline) : ""
  );
  const [estimatedPomodoros, setEstimatedPomodoros] = useState<string>(
    todo?.estimatedPomodoros != null ? String(todo.estimatedPomodoros) : ""
  );
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!title.trim()) {
      setError("标题不能为空");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: any = {
        title: title.trim(),
        description: description.trim() || null,
        priority,
      };
      // 转换为 ISO string
      payload.deadline = deadline ? new Date(deadline).toISOString() : null;
      const estNum = estimatedPomodoros ? parseInt(estimatedPomodoros, 10) : null;
      payload.estimatedPomodoros = estNum && estNum > 0 ? estNum : null;

      if (isEdit) {
        await apiFetch(`/api/todos/${todo!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/api/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      onSaved();
    } catch (e) {
      setError("保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!todo) return;
    if (!confirm("确定删除这个任务？")) return;
    await apiFetch(`/api/todos/${todo.id}`, { method: "DELETE" });
    onDeleted();
  }

  // ESC 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSave();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [title, description, priority, deadline, estimatedPomodoros]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-slate-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {isEdit ? "编辑任务" : "新建任务"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 dark:bg-slate-800 rounded-md text-gray-500 dark:text-gray-400 dark:text-gray-500"
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 标题 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">标题 *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="任务标题"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-tomato-400 outline-none text-sm"
              autoFocus
            />
          </div>

          {/* 优先级 + 四象限相关字段 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">优先级</label>
              <div className="flex gap-2">
                {([0, 1, 2] as const).map((p) => {
                  const cfg = PRIORITY_COLORS[p];
                  return (
                    <button
                      key={p}
                      onClick={() => setPriority(p)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition border flex-1",
                        priority === p
                          ? `${cfg.bg} ${cfg.text} border-current`
                          : "bg-white dark:bg-slate-900 text-gray-500 dark:text-gray-400 dark:text-gray-500 border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 dark:border-slate-600"
                      )}
                    >
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">截止时间</label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-tomato-400 outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">预计番茄数</label>
              <input
                type="number"
                min={1}
                max={50}
                value={estimatedPomodoros}
                onChange={(e) => setEstimatedPomodoros(e.target.value)}
                placeholder="如 4"
                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-tomato-400 outline-none text-sm"
              />
            </div>
          </div>

          {/* 描述（markdown） */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              详情 <span className="text-gray-400 dark:text-gray-500 font-normal">（支持 Markdown）</span>
            </label>
            <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="flex items-center gap-1 p-1.5 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
                <button
                  onClick={() => setTab("edit")}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-medium transition",
                    tab === "edit" ? "bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 shadow-sm" : "text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 dark:text-gray-300"
                  )}
                >
                  ✏️ 编辑
                </button>
                <button
                  onClick={() => setTab("preview")}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-medium transition",
                    tab === "preview" ? "bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 shadow-sm" : "text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 dark:text-gray-300"
                  )}
                >
                  👁 预览
                </button>
                <div className="flex-1" />
                <span className="text-[10px] text-gray-400 dark:text-gray-500 mr-1">{description.length} 字</span>
              </div>
              {tab === "edit" ? (
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={"支持 Markdown：\n# 标题\n- 列表\n**粗体** `代码`\n[链接](https://...)\n```\n代码块\n```"}
                  rows={10}
                  className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-900 focus:outline-none resize-y font-mono"
                />
              ) : (
                <div className="px-3 py-2.5 min-h-[200px]">
                  {description.trim() ? (
                    <MarkdownView content={description} />
                  ) : (
                    <p className="text-sm text-gray-400 dark:text-gray-500 italic">预览（暂无内容）</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="text-sm text-tomato-700 bg-tomato-50 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="flex items-center justify-between p-4 border-t border-gray-100 dark:border-slate-700">
          <div>
            {isEdit && (
              <button
                onClick={handleDelete}
                className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:text-tomato-600 transition flex items-center gap-1"
              >
                <Trash2 size={12} /> 删除
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 dark:bg-slate-800 rounded-lg transition"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 text-sm bg-tomato-500 hover:bg-tomato-600 disabled:opacity-50 text-white rounded-lg transition active:scale-95"
            >
              {saving ? "保存中…" : isEdit ? "保存" : "创建"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
