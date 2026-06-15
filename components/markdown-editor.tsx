"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Eye, Edit3 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Markdown 编辑器（左编辑 + 切换预览）
 * 移动端自动单栏（tab 切换）
 */
export function MarkdownEditor({
  value,
  onChange,
  placeholder = "支持 Markdown 语法：\n# 标题\n- 列表\n**粗体** `代码` ```\n[链接](url) ```",
  rows = 8,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}) {
  const [tab, setTab] = useState<"edit" | "preview">("edit");

  return (
    <div className={cn("rounded-xl border border-gray-200 bg-white overflow-hidden", className)}>
      <div className="flex items-center gap-1 p-1.5 border-b border-gray-100 bg-gray-50/50">
        <button
          onClick={() => setTab("edit")}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition",
            tab === "edit" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          )}
        >
          <Edit3 size={12} /> 编辑
        </button>
        <button
          onClick={() => setTab("preview")}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition",
            tab === "preview" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          )}
        >
          <Eye size={12} /> 预览
        </button>
        <div className="flex-1" />
        <span className="text-[10px] text-gray-400 mr-1">{value.length} 字</span>
      </div>

      {tab === "edit" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="w-full px-3 py-2.5 text-sm bg-white focus:outline-none resize-y font-mono"
        />
      ) : (
        <div className="px-3 py-2.5 min-h-[100px] max-h-[400px] overflow-y-auto">
          {value.trim() ? (
            <MarkdownView content={value} />
          ) : (
            <p className="text-sm text-gray-400 italic">预览（暂无内容）</p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Markdown 只读渲染
 */
export function MarkdownView({
  content,
  className,
  compact = false,
}: {
  content: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "markdown-body text-sm text-gray-700",
        compact && "markdown-compact",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // 自定义元素样式
          h1: ({ children }) => <h1 className="text-lg font-bold mt-3 mb-1.5 text-gray-900 first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-bold mt-3 mb-1.5 text-gray-900 first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold mt-2.5 mb-1 text-gray-900 first:mt-0">{children}</h3>,
          p: ({ children }) => <p className={cn("leading-relaxed", compact ? "my-1" : "my-2")}>{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-5 my-1.5 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 my-1.5 space-y-0.5">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-tomato-600 hover:text-tomato-700 underline underline-offset-2"
            >
              {children}
            </a>
          ),
          code: ({ children, className }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="px-1.5 py-0.5 rounded bg-gray-100 text-tomato-600 text-[12px] font-mono">
                  {children}
                </code>
              );
            }
            return (
              <code className="block bg-gray-900 text-gray-100 p-2.5 rounded-lg text-xs font-mono overflow-x-auto my-2">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="my-2">{children}</pre>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-tomato-300 pl-3 py-0.5 my-1.5 text-gray-600 italic">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-3 border-gray-200" />,
          table: ({ children }) => (
            <div className="overflow-x-auto my-2">
              <table className="min-w-full text-xs border border-gray-200">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
          th: ({ children }) => <th className="px-2 py-1 border border-gray-200 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="px-2 py-1 border border-gray-200">{children}</td>,
          input: ({ type, checked, disabled }) => {
            if (type === "checkbox") {
              return (
                <input
                  type="checkbox"
                  checked={checked}
                  disabled
                  className="mr-1.5 align-middle accent-tomato-500"
                />
              );
            }
            return null;
          },
          strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          del: ({ children }) => <del className="line-through text-gray-500">{children}</del>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
