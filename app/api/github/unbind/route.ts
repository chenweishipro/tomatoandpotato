import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await prisma.user.update({
    where: { id: user.id },
    data: { githubId: null, githubLogin: null, githubAvatar: null, githubBoundAt: null },
  });
  return NextResponse.json({ ok: true });
}
