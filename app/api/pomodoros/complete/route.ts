import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

const Schema = z.object({
  type: z.enum(["focus", "short_break", "long_break"]),
  durationMin: z.number().int().min(1).max(120),
  todoId: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "参数错误" }, { status: 400 });

  // 验证 todoId 属于这个 user
  let todoId: string | null = null;
  if (parsed.data.todoId) {
    const todo = await prisma.todo.findFirst({
      where: { id: parsed.data.todoId, userId: user.id },
    });
    if (todo) todoId = todo.id;
  }

  const pomo = await prisma.pomodoro.create({
    data: {
      userId: user.id,
      todoId,
      type: parsed.data.type,
      durationMin: parsed.data.durationMin,
    },
  });

  return NextResponse.json({ id: pomo.id });
}
