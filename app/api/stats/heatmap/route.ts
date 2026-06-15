import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const yearParam = searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);

  const pomodoros = await prisma.pomodoro.findMany({
    where: {
      userId: user.id,
      type: "focus",
      completedAt: { gte: start, lt: end },
    },
    select: { completedAt: true },
  });

  // map: dateStr -> count
  const map: Record<string, number> = {};
  for (const p of pomodoros) {
    const key = p.completedAt.toISOString().slice(0, 10);
    map[key] = (map[key] ?? 0) + 1;
  }

  return NextResponse.json({ year, days: map });
}
