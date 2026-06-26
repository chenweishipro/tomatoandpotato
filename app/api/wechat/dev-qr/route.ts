import { NextResponse } from "next/server";
import { devWechatUserInfo, WECHAT_ENABLED } from "@/lib/wechat";

// 仅 dev mode: 显示一个"模拟扫码"页面 (HTML)
export async function GET(req: Request) {
  if (WECHAT_ENABLED) {
    return NextResponse.json({ error: "Dev QR 不应在真微信模式下访问" }, { status: 400 });
  }
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>微信登录 - 模拟</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; background: #f5f5f5; min-height: 100vh; display: flex; align-items: center; justify-content: center; margin: 0; }
  .card { background: #fff; border-radius: 16px; padding: 32px; max-width: 360px; box-shadow: 0 4px 16px rgba(0,0,0,.08); text-align: center; }
  h1 { color: #07c160; margin: 0 0 8px; font-size: 22px; }
  .badge { background: #fff3cd; color: #856404; padding: 4px 12px; border-radius: 999px; font-size: 12px; display: inline-block; margin-bottom: 16px; }
  p { color: #666; font-size: 14px; line-height: 1.6; margin: 12px 0; }
  .btn { background: #07c160; color: #fff; border: 0; padding: 12px 32px; border-radius: 8px; font-size: 16px; cursor: pointer; margin-top: 16px; width: 100%; font-weight: 500; }
  .btn:hover { background: #06ae56; }
  .qr-box { width: 180px; height: 180px; background: #f0f0f0; border: 2px solid #07c160; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin: 16px auto; font-size: 64px; }
  .close { color: #999; font-size: 12px; margin-top: 12px; display: block; cursor: pointer; text-decoration: none; }
</style>
</head>
<body>
<div class="card">
  <span class="badge">⚠️ Dev 模式 (未配 WECHAT_APP_ID)</span>
  <h1>🟢 模拟微信扫码</h1>
  <div class="qr-box">📱</div>
  <p>配置 <code>WECHAT_APP_ID</code> + <code>WECHAT_APP_SECRET</code> 环境变量后可接入真微信扫码登录。</p>
  <p>现在点下方按钮模拟扫码成功</p>
  <form method="POST" action="${process.env.NEXTAUTH_URL || new URL(req.url).origin}/api/wechat/dev-scan">
    <input type="hidden" name="state" value="${new URL(req.url).searchParams.get("state") || ""}">
    <button class="btn" type="submit">✓ 模拟扫码成功</button>
  </form>
  <a class="close" href="${process.env.NEXTAUTH_URL || new URL(req.url).origin}/login/">取消</a>
</div>
</body>
</html>`;
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
