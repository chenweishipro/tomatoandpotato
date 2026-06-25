import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { exchangeCode, fetchWechatUserInfo, devWechatUserInfo, WECHAT_ENABLED } from "@/lib/wechat";

/**
 * 绑定流程 callback:
 * state 格式: bind_<userId>_<ts>_<rand>
 * 用 code 拿 openid, 然后绑到 userId
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const baseUrl = process.env.NEXTAUTH_URL || "http://122.51.221.63/tomato";

  // state 解析 userId
  const parts = state.split("_");
  if (parts[0] !== "bind" || !parts[1]) {
    return NextResponse.redirect(`${baseUrl}/app/settings/?wechat_bind=invalid_state`, { status: 302 });
  }
  const userId = parts[1];

  // 必须登录 (cookie 验证)
  const user = await getCurrentUser();
  if (!user || user.id !== userId) {
    return NextResponse.redirect(`${baseUrl}/login/?error=wechat_bind_unauthorized`, { status: 302 });
  }

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/app/settings/?wechat_bind=no_code`, { status: 302 });
  }

  try {
    let userInfo;
    if (WECHAT_ENABLED && !code.startsWith("dev_")) {
      const tokenData = await exchangeCode(code);
      userInfo = await fetchWechatUserInfo(tokenData.access_token, tokenData.openid);
    } else {
      userInfo = devWechatUserInfo();
    }

    // 查 openid 已被别的 user 绑?
    const existing = await prisma.user.findUnique({ where: { wechatOpenid: userInfo.openid } });
    if (existing && existing.id !== userId) {
      return NextResponse.redirect(`${baseUrl}/app/settings/?wechat_bind=already_bound`, { status: 302 });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        wechatOpenid: userInfo.openid,
        wechatUnionid: userInfo.unionid ?? null,
        wechatNickname: userInfo.nickname,
        wechatAvatar: userInfo.headimgurl || null,
        wechatBoundAt: new Date(),
      },
    });

    return NextResponse.redirect(`${baseUrl}/app/settings/?wechat_bind=success`, { status: 302 });
  } catch (err: any) {
    return NextResponse.redirect(
      `${baseUrl}/app/settings/?wechat_bind=failed&msg=${encodeURIComponent(err.message)}`,
      { status: 302 }
    );
  }
}
