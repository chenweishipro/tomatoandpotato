import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  exchangeCode,
  fetchWechatUserInfo,
  devWechatUserInfo,
  WECHAT_ENABLED,
  generateState,
} from "@/lib/wechat";
import { encode } from "next-auth/jwt";

const SESSION_SECRET = process.env.NEXTAUTH_SECRET || "dev-secret";

/**
 * 微信 OAuth 2.0 callback
 *
 * 流程:
 * 1. 微信回调 → 收到 code + state
 * 2. 用 code 换 access_token + openid
 * 3. 用 access_token + openid 拿 user info
 * 4. 查 user by openid: 有 → 登入; 没 → 建 user (无密码, 微信登录)
 * 5. 生成 NextAuth JWT, set cookie, 跳回主页
 *
 * Dev 模式: code 以 "dev_" 开头 → 直接生成假 user info
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const baseUrl = process.env.NEXTAUTH_URL || "http://122.51.221.63/tomato";

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/login/?error=wechat_no_code`, { status: 302 });
  }

  try {
    let userInfo;
    if (WECHAT_ENABLED && !code.startsWith("dev_")) {
      // 真微信模式
      const tokenData = await exchangeCode(code);
      userInfo = await fetchWechatUserInfo(tokenData.access_token, tokenData.openid);
    } else {
      // Dev 模式
      userInfo = devWechatUserInfo();
    }

    // 查 user (by openid)
    let user = await prisma.user.findUnique({
      where: { wechatOpenid: userInfo.openid },
    });

    if (!user) {
      // 查是不是 by unionid (跨 app 共享)
      if (userInfo.unionid) {
        user = await prisma.user.findUnique({
          where: { wechatUnionid: userInfo.unionid },
        });
      }
    }

    if (!user) {
      // 创建新 user (无密码, 只能微信登录; 邮箱随机生成避免冲突)
      const randomEmail = `wx_${userInfo.openid.slice(-8)}@wechat.local`;
      user = await prisma.user.create({
        data: {
          email: randomEmail,
          // 用一个永远不可能 user 输入匹配的 hash (bcrypt of random 64-char string)
          passwordHash: "$2a$10$" + "X".repeat(53) + "INVALID_WECHAT_ONLY_NO_PASSWORD",
          name: userInfo.nickname,
          wechatOpenid: userInfo.openid,
          wechatUnionid: userInfo.unionid ?? null,
          wechatNickname: userInfo.nickname,
          wechatAvatar: userInfo.headimgurl || null,
          wechatBoundAt: new Date(),
        },
      });
      // 创 settings 默认值
      await prisma.settings.create({
        data: { userId: user.id },
      });
    } else {
      // 已存在: 更新微信信息 (nickname / avatar 可能变了)
      await prisma.user.update({
        where: { id: user.id },
        data: {
          wechatNickname: userInfo.nickname,
          wechatAvatar: userInfo.headimgurl || user.wechatAvatar,
          wechatBoundAt: user.wechatBoundAt || new Date(),
        },
      });
    }

    // 生成 NextAuth JWT (复用 next-auth encode 接口, 让 SessionProvider 认出)
    const token = await encode({
      token: { id: user.id, email: user.email, name: user.name ?? undefined },
      secret: SESSION_SECRET,
      maxAge: 30 * 24 * 60 * 60, // 30 天
    });

    // Set cookie (next-auth 用 __Secure- 前缀在 https, 但我们 http 用简单 cookie)
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
    console.error("wechat callback error:", err);
    return NextResponse.redirect(
      `${baseUrl}/login/?error=wechat_failed&msg=${encodeURIComponent(err.message || "unknown")}`,
      { status: 302 }
    );
  }
}
