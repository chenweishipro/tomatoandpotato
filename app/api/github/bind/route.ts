import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { exchangeGithubCode, fetchGithubUserInfo, GITHUB_ENABLED } from "@/lib/github";

/**
 * 绑定 GitHub: 已登录 user 用 code 绑定
 * body: { code: string }
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const code = body.code?.toString();
    if (!code) return NextResponse.json({ error: "缺少 code" }, { status: 400 });

    let userInfo;
    if (GITHUB_ENABLED && !code.startsWith("dev_")) {
      const accessToken = await exchangeGithubCode(code);
      userInfo = await fetchGithubUserInfo(accessToken);
    } else {
      // dev mode: 用 devGithubUserInfo 但需要 import
      const { devGithubUserInfo } = await import("@/lib/github");
      userInfo = devGithubUserInfo();
    }

    // 查 githubId 已被别的 user 绑?
    const existing = await prisma.user.findUnique({ where: { githubId: userInfo.id } });
    if (existing && existing.id !== user.id) {
      return NextResponse.json({ error: "该 GitHub 账号已绑定其他用户" }, { status: 409 });
    }

    // 当前 user 已绑过别的 GitHub?
    if (user.githubId && user.githubId !== userInfo.id) {
      return NextResponse.json({ error: "当前账号已绑定其他 GitHub, 请先解绑" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        githubId: userInfo.id,
        githubLogin: userInfo.login,
        githubAvatar: userInfo.avatar_url || user.githubAvatar,
        githubBoundAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      github: {
        id: userInfo.id,
        login: userInfo.login,
        avatar: userInfo.avatar_url,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "bind failed" }, { status: 500 });
  }
}

/**
 * 生成绑定用的授权 URL (前端展示)
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const baseUrl = process.env.NEXTAUTH_URL || "http://122.51.221.63/tomato";
  const state = `bind_${user.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const callbackUrl = `${baseUrl}/api/github/bind-callback?state=${encodeURIComponent(state)}`;

  const { buildGithubAuthUrl, GITHUB_ENABLED: enabled } = await import("@/lib/github");
  const url = buildGithubAuthUrl(callbackUrl, state);
  return NextResponse.json({ url, state, enabled });
}
