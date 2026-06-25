import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10), 500);
  const date = searchParams.get("date"); // YYYY-MM-DD (本地时间, 单日范围)

  // 计算单日的 UTC 范围: 当地 0:00 到次日 0:00
  let dateFilter: { gte: Date; lt: Date } | undefined;
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const dayStart = new Date(date + "T00:00:00");
    const dayEnd = new Date(date + "T23:59:59.999");
    if (!isNaN(dayStart.getTime())) {
      dateFilter = { gte: dayStart, lt: dayEnd };
    }
  }

  const pomodoros = await prisma.pomodoro.findMany({
    where: { userId: user.id, ...(dateFilter ? { completedAt: dateFilter } : {}) },
    orderBy: { completedAt: "desc" },
    take: limit,
    include: { todo: { select: { id: true, title: true } } },
  });

  return NextResponse.json({
    pomodoros: pomodoros.map((p) => ({
      id: p.id,
      type: p.type,
      durationMin: p.durationMin,
      completedAt: p.completedAt.toISOString(),
      todo: p.todo ? { id: p.todo.id, title: p.todo.title } : null,
    })),
  });
}
