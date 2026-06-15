import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { startOfWeek, startOfDay, endOfDay } from "@/lib/utils";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const start = startOfWeek();
  const end = endOfDay();

  const pomodoros = await prisma.pomodoro.findMany({
    where: {
      userId: user.id,
      type: "focus",
      completedAt: { gte: start, lte: end },
    },
    select: { completedAt: true, durationMin: true },
  });

  // 7 天桶
  const buckets: { date: string; count: number; minutes: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    buckets.push({
      date: d.toISOString().slice(0, 10),
      count: 0,
      minutes: 0,
    });
  }

  for (const p of pomodoros) {
    const key = p.completedAt.toISOString().slice(0, 10);
    const bucket = buckets.find((b) => b.date === key);
    if (bucket) {
      bucket.count++;
      bucket.minutes += p.durationMin;
    }
  }

  return NextResponse.json({ days: buckets });
}
