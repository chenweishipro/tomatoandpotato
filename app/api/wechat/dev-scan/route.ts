import { NextResponse } from "next/server";
import { WECHAT_ENABLED } from "@/lib/wechat";

export async function POST(req: Request) {
  if (WECHAT_ENABLED) {
    return NextResponse.json({ error: "Dev scan 不应在真微信模式下访问" }, { status: 400 });
  }
  // 模拟一个 fake code, 跳到真实 callback (callback 会识别 dev_ 前缀自动通过)
  const formData = await req.formData();
  const state = formData.get("state")?.toString() || "";
  const baseUrl = process.env.NEXTAUTH_URL || "http://122.51.221.63/tomato";
  const fakeCode = "dev_" + Math.random().toString(36).slice(2, 12);
  const callbackUrl = `${baseUrl}/api/wechat/callback?code=${fakeCode}&state=${encodeURIComponent(state)}`;
  return NextResponse.redirect(callbackUrl, { status: 302 });
}
