import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!user.wechatOpenid) {
    return NextResponse.json({ bound: false });
  }

  return NextResponse.json({
    bound: true,
    openid: user.wechatOpenid,
    nickname: user.wechatNickname,
    avatar: user.wechatAvatar,
    boundAt: user.wechatBoundAt instanceof Date ? user.wechatBoundAt.toISOString() : user.wechatBoundAt || null,
  });
}
