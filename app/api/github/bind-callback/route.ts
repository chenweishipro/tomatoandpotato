import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { exchangeGithubCode, fetchGithubUserInfo, devGithubUserInfo, GITHUB_ENABLED } from "@/lib/github";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const baseUrl = process.env.NEXTAUTH_URL || "http://122.51.221.63/tomato";

  // state 解析 userId
  const parts = state.split("_");
  if (parts[0] !== "bind" || !parts[1]) {
    return NextResponse.redirect(`${baseUrl}/app/settings/?github_bind=invalid_state`, { status: 302 });
  }
  const userId = parts[1];

  const user = await getCurrentUser();
  if (!user || user.id !== userId) {
    return NextResponse.redirect(`${baseUrl}/login/?error=github_bind_unauthorized`, { status: 302 });
  }

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/app/settings/?github_bind=no_code`, { status: 302 });
  }

  try {
    let userInfo;
    if (GITHUB_ENABLED && !code.startsWith("dev_")) {
      const accessToken = await exchangeGithubCode(code);
      userInfo = await fetchGithubUserInfo(accessToken);
    } else {
      userInfo = devGithubUserInfo();
    }

    const existing = await prisma.user.findUnique({ where: { githubId: userInfo.id } });
    if (existing && existing.id !== userId) {
      return NextResponse.redirect(`${baseUrl}/app/settings/?github_bind=already_bound`, { status: 302 });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        githubId: userInfo.id,
        githubLogin: userInfo.login,
        githubAvatar: userInfo.avatar_url || null,
        githubBoundAt: new Date(),
      },
    });

    return NextResponse.redirect(`${baseUrl}/app/settings/?github_bind=success`, { status: 302 });
  } catch (err: any) {
    return NextResponse.redirect(
      `${baseUrl}/app/settings/?github_bind=failed&msg=${encodeURIComponent(err.message)}`,
      { status: 302 }
    );
  }
}
