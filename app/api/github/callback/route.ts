import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  exchangeGithubCode,
  fetchGithubUserInfo,
  devGithubUserInfo,
  GITHUB_ENABLED,
} from "@/lib/github";
import { encode } from "next-auth/jwt";

const SESSION_SECRET = process.env.NEXTAUTH_SECRET || "dev-secret";

/**
 * GitHub OAuth callback
 * 1. GitHub 回调 → 收到 code + state
 * 2. 用 code 换 access_token
 * 3. 用 access_token 拿 user info (id, login, name, avatar, email)
 * 4. 查 user by githubId: 有 → 登入; 没 → 建 user
 * 5. 生成 NextAuth JWT + set cookie + 跳 /app/
 *
 * Dev 模式: code 以 "dev_" 开头 → 直接 devGithubUserInfo()
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code") || "";
  const baseUrl = process.env.NEXTAUTH_URL || "http://122.51.221.63/tomato";

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/login/?error=github_no_code`, { status: 302 });
  }

  try {
    let userInfo;
    if (GITHUB_ENABLED && !code.startsWith("dev_")) {
      // 真 GitHub 模式
      const accessToken = await exchangeGithubCode(code);
      userInfo = await fetchGithubUserInfo(accessToken);
    } else {
      // Dev 模式
      userInfo = devGithubUserInfo();
    }

    // 查 user (by githubId)
    let user = await prisma.user.findUnique({
      where: { githubId: userInfo.id },
    });

    if (!user) {
      // 查是不是 by email (用邮箱关联)
      if (userInfo.email) {
        user = await prisma.user.findUnique({ where: { email: userInfo.email } });
      }
    }

    if (!user) {
      // 创建新 user (无密码, 只能 GitHub 登录; 邮箱 fallback)
      const email = userInfo.email || `gh_${userInfo.id}@github.local`;
      user = await prisma.user.create({
        data: {
          email,
          passwordHash: "$2a$10$" + "X".repeat(53) + "INVALID_GITHUB_ONLY_NO_PASSWORD",
          name: userInfo.name || userInfo.login,
          githubId: userInfo.id,
          githubLogin: userInfo.login,
          githubAvatar: userInfo.avatar_url || null,
          githubBoundAt: new Date(),
        },
      });
      // 创 settings 默认值
      await prisma.settings.create({ data: { userId: user.id } });
    } else {
      // 已存在: 更新 GitHub 信息
      await prisma.user.update({
        where: { id: user.id },
        data: {
          githubId: userInfo.id, // 关联上
          githubLogin: userInfo.login,
          githubAvatar: userInfo.avatar_url || user.githubAvatar,
          githubBoundAt: user.githubBoundAt || new Date(),
        },
      });
    }

    // 生成 NextAuth JWT
    const token = await encode({
      token: { id: user.id, email: user.email, name: user.name ?? undefined },
      secret: SESSION_SECRET,
      maxAge: 30 * 24 * 60 * 60,
    });

    const cookieName = process.env.NODE_ENV === "production" && baseUrl.startsWith("https")
      ? "__Secure-next-auth.session-token"
      : "next-auth.session-token";

    const response = NextResponse.redirect(`${baseUrl}/app/`, { status: 302 });
    response.cookies.set({
      name: cookieName,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
    return response;
  } catch (err: any) {
    console.error("github callback error:", err);
    return NextResponse.redirect(
      `${baseUrl}/login/?error=github_failed&msg=${encodeURIComponent(err.message || "unknown")}`,
      { status: 302 }
    );
  }
}
