import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

const PatchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  priority: z.number().int().min(0).max(2).optional(),
  status: z.enum(["todo", "doing", "done", "archived"]).optional(),
  order: z.number().int().optional(),
  tags: z.string().max(200).nullable().optional(),
  deadline: z.string().datetime().nullable().optional(),
  estimatedPomodoros: z.number().int().min(1).max(100).nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "参数错误" }, { status: 400 });

  const existing = await prisma.todo.findFirst({
    where: { id: params.id, userId: user.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: any = { ...parsed.data };
  if (parsed.data.status === "done" && existing.status !== "done") {
    data.completedAt = new Date();
  } else if (parsed.data.status && parsed.data.status !== "done") {
    data.completedAt = null;
  }

  await prisma.todo.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.todo.findFirst({
    where: { id: params.id, userId: user.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // 软删：移到 archived
  await prisma.todo.update({
    where: { id: params.id },
    data: { status: "archived" },
  });

  return NextResponse.json({ ok: true });
}
