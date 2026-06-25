import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { exchangeCode, fetchWechatUserInfo, devWechatUserInfo, WECHAT_ENABLED } from "@/lib/wechat";

/**
 * 绑定微信: 已登录 user 用 code 绑定
 *
 * body: { code: string }
 * 流程: code → openid → 查 user by openid
 *   - openid 已被别的账号绑定 → 409 conflict
 *   - 当前 user 已绑别的微信 → 400 (先 unbind)
 *   - 否则绑定到当前 user
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const code = body.code?.toString();
    if (!code) return NextResponse.json({ error: "缺少 code" }, { status: 400 });

    let userInfo;
    if (WECHAT_ENABLED && !code.startsWith("dev_")) {
      const tokenData = await exchangeCode(code);
      userInfo = await fetchWechatUserInfo(tokenData.access_token, tokenData.openid);
    } else {
      userInfo = devWechatUserInfo();
    }

    // 查 openid 是否已被别的 user 绑定
    const existingByOpenid = await prisma.user.findUnique({
      where: { wechatOpenid: userInfo.openid },
    });
    if (existingByOpenid && existingByOpenid.id !== user.id) {
      return NextResponse.json(
        { error: "该微信已绑定其他账号" },
        { status: 409 }
      );
    }

    // 当前 user 已绑过?
    if (user.wechatOpenid && user.wechatOpenid !== userInfo.openid) {
      return NextResponse.json(
        { error: "当前账号已绑定其他微信, 请先解绑" },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        wechatOpenid: userInfo.openid,
        wechatUnionid: userInfo.unionid ?? user.wechatUnionid,
        wechatNickname: userInfo.nickname,
        wechatAvatar: userInfo.headimgurl || user.wechatAvatar,
        wechatBoundAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      wechat: {
        openid: userInfo.openid,
        nickname: userInfo.nickname,
        avatar: userInfo.headimgurl,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "bind failed" }, { status: 500 });
  }
}

/**
 * 生成绑定用的扫码 URL (前端展示)
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const baseUrl = process.env.NEXTAUTH_URL || "http://122.51.221.63/tomato";
  const state = `bind_${user.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  // 绑定: callback 用同一 URL, 但 state 前缀 bind_ 区分
  const callbackUrl = `${baseUrl}/api/wechat/bind-callback?state=${encodeURIComponent(state)}`;
  let qrUrl: string;
  if (WECHAT_ENABLED) {
    const params = new URLSearchParams({
      appid: process.env.WECHAT_APP_ID!,
      redirect_uri: callbackUrl,
      response_type: "code",
      scope: "snsapi_login",
      state,
    });
    qrUrl = `https://open.weixin.qq.com/connect/qrconnect?${params.toString()}#wechat_redirect`;
  } else {
    qrUrl = `/tomato/api/wechat/dev-qr?state=${state}&redirect_uri=${encodeURIComponent(callbackUrl)}`;
  }
  return NextResponse.json({ url: qrUrl, state, enabled: WECHAT_ENABLED });
}
