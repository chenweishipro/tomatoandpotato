import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const year = parseInt(searchParams.get("year") ?? String(now.getFullYear()), 10);
  const month = parseInt(searchParams.get("month") ?? String(now.getMonth() + 1), 10); // 1-12

  // 月初到下月初（不含）
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const pomodoros = await prisma.pomodoro.findMany({
    where: {
      userId: user.id,
      type: "focus",
      completedAt: { gte: start, lt: end },
    },
    select: { completedAt: true },
  });

  const map: Record<string, number> = {};
  for (const p of pomodoros) {
    const key = p.completedAt.toISOString().slice(0, 10);
    map[key] = (map[key] ?? 0) + 1;
  }

  return NextResponse.json({ year, month, days: map });
}
