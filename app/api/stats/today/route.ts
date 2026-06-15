import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { startOfDay, endOfDay } from "@/lib/utils";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const start = startOfDay();
  const end = endOfDay();

  const pomodoros = await prisma.pomodoro.findMany({
    where: { userId: user.id, completedAt: { gte: start, lte: end } },
    select: { type: true, durationMin: true },
  });

  const focusCount = pomodoros.filter((p) => p.type === "focus").length;
  const focusMinutes = pomodoros
    .filter((p) => p.type === "focus")
    .reduce((s, p) => s + p.durationMin, 0);

  const todosDone = await prisma.todo.count({
    where: { userId: user.id, status: "done", completedAt: { gte: start, lte: end } },
  });

  return NextResponse.json({
    focusCount,
    focusMinutes,
    todosDone,
    pomodoros,
  });
}
