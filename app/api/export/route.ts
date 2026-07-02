import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "用户不存在" }, { status: 404 });

  const url = new URL(req.url);
  const format = url.searchParams.get("format") || "json"; // json / csv

  const [todos, pomodoros, settings] = await Promise.all([
    prisma.todo.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    prisma.pomodoro.findMany({ where: { userId: user.id }, orderBy: { completedAt: "asc" } }),
    prisma.settings.findUnique({ where: { userId: user.id } }),
  ]);

  const exportedAt = new Date().toISOString();
  const payload = {
    exportedAt,
    user: { email: user.email, name: user.name, createdAt: user.createdAt },
    settings,
    todos,
    pomodoros,
  };

  if (format === "csv") {
    // 简化 CSV: 只导出 todos + pomodoros 两个核心表
    const csv: string[] = [];
    csv.push("# 胡萝卜 数据导出");
    csv.push(`# 导出时间: ${exportedAt}`);
    csv.push(`# 用户: ${user.email}`);
    csv.push("");
    csv.push("## Todos");
    csv.push("id,title,description,priority,status,deadline,estimatedPomodoros,createdAt,completedAt");
    for (const t of todos) {
      csv.push([
        t.id,
        JSON.stringify(t.title),
        JSON.stringify(t.description ?? ""),
        t.priority,
        t.status,
        t.deadline?.toISOString() ?? "",
        t.estimatedPomodoros ?? "",
        t.createdAt.toISOString(),
        t.completedAt?.toISOString() ?? "",
      ].join(","));
    }
    csv.push("");
    csv.push("## Pomodoros");
    csv.push("id,type,durationMin,todoId,completedAt");
    for (const p of pomodoros) {
      csv.push([p.id, p.type, p.durationMin, p.todoId ?? "", p.completedAt.toISOString()].join(","));
    }
    return new Response(csv.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="tomato-export-${Date.now()}.csv"`,
      },
    });
  }

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="tomato-export-${Date.now()}.json"`,
    },
  });
}
