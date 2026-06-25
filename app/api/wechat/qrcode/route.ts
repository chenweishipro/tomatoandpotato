import { NextResponse } from "next/server";
import { buildWechatQrUrl, generateState, WECHAT_ENABLED } from "@/lib/wechat";

export async function GET(req: Request) {
  const baseUrl = process.env.NEXTAUTH_URL || "http://122.51.221.63/tomato";
  const callbackUrl = `${baseUrl}/api/wechat/callback`;
  const state = generateState();
  const url = buildWechatQrUrl(callbackUrl, state);
  return NextResponse.json({
    url,
    state,
    enabled: WECHAT_ENABLED,
    // dev 模式提示
    dev: !WECHAT_ENABLED,
  });
}
