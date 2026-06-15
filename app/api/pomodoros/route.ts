import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10), 500);

  const pomodoros = await prisma.pomodoro.findMany({
    where: { userId: user.id },
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
