import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

const Schema = z.object({
  focusMinutes: z.number().int().min(1).max(120).optional(),
  shortBreakMin: z.number().int().min(1).max(60).optional(),
  longBreakMin: z.number().int().min(1).max(120).optional(),
  pomosBeforeLong: z.number().int().min(2).max(10).optional(),
  autoStartBreak: z.boolean().optional(),
  desktopNotif: z.boolean().optional(),
  soundEnabled: z.boolean().optional(),
  soundType: z.string().max(20).optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let settings = await prisma.settings.findUnique({ where: { userId: user.id } });
  if (!settings) {
    settings = await prisma.settings.create({ data: { userId: user.id } });
  }

  return NextResponse.json({
    focusMinutes: settings.focusMinutes,
    shortBreakMin: settings.shortBreakMin,
    longBreakMin: settings.longBreakMin,
    pomosBeforeLong: settings.pomosBeforeLong,
    autoStartBreak: settings.autoStartBreak,
    desktopNotif: settings.desktopNotif,
    soundEnabled: settings.soundEnabled,
    soundType: settings.soundType,
  });
}

export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "参数错误" }, { status: 400 });

  const settings = await prisma.settings.upsert({
    where: { userId: user.id },
    update: parsed.data,
    create: { userId: user.id, ...parsed.data },
  });

  return NextResponse.json({ ok: true, settings });
}
