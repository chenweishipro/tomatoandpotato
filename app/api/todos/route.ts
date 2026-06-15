import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

const CreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  priority: z.number().int().min(0).max(2).optional(),
  tags: z.string().max(200).optional(),
  deadline: z.string().datetime().nullable().optional(),
  estimatedPomodoros: z.number().int().min(1).max(100).nullable().optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const todos = await prisma.todo.findMany({
    where: { userId: user.id, status: { not: "archived" } },
    orderBy: [{ status: "asc" }, { priority: "asc" }, { order: "desc" }, { createdAt: "desc" }],
    include: {
      _count: { select: { pomodoros: { where: { type: "focus" } } } },
    },
  });

  return NextResponse.json({
    todos: todos.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      priority: t.priority,
      deadline: t.deadline?.toISOString() ?? null,
      estimatedPomodoros: t.estimatedPomodoros,
      status: t.status,
      tags: t.tags,
      pomodoroCount: t._count.pomodoros,
      createdAt: t.createdAt.toISOString(),
      completedAt: t.completedAt?.toISOString() ?? null,
    })),
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 });
  }

  const max = await prisma.todo.aggregate({
    where: { userId: user.id },
    _max: { order: true },
  });

  const todo = await prisma.todo.create({
    data: {
      userId: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      priority: parsed.data.priority ?? 1,
      tags: parsed.data.tags,
      deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : null,
      estimatedPomodoros: parsed.data.estimatedPomodoros ?? null,
      order: (max._max.order ?? 0) + 1,
    },
  });

  return NextResponse.json({ id: todo.id });
}
