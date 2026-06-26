import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.githubId) return NextResponse.json({ bound: false });
  return NextResponse.json({
    bound: true,
    id: user.githubId,
    login: user.githubLogin,
    avatar: user.githubAvatar,
    boundAt: user.githubBoundAt instanceof Date ? user.githubBoundAt.toISOString() : user.githubBoundAt,
  });
}
