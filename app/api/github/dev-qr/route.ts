import { NextResponse } from "next/server";
import { GITHUB_ENABLED } from "@/lib/github";

export async function GET(req: Request) {
  if (GITHUB_ENABLED) {
    return NextResponse.json({ error: "Dev QR 不应在真 GitHub 模式下访问" }, { status: 400 });
  }
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>GitHub 登录 - 模拟</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; background: #f5f5f5; min-height: 100vh; display: flex; align-items: center; justify-content: center; margin: 0; }
  .card { background: #fff; border-radius: 16px; padding: 32px; max-width: 380px; box-shadow: 0 4px 16px rgba(0,0,0,.08); text-align: center; }
  h1 { color: #24292e; margin: 0 0 8px; font-size: 22px; }
  .badge { background: #fff3cd; color: #856404; padding: 4px 12px; border-radius: 999px; font-size: 12px; display: inline-block; margin-bottom: 16px; }
  p { color: #666; font-size: 14px; line-height: 1.6; margin: 12px 0; }
  .btn { background: #24292e; color: #fff; border: 0; padding: 12px 32px; border-radius: 8px; font-size: 16px; cursor: pointer; margin-top: 16px; width: 100%; font-weight: 500; }
  .btn:hover { background: #1a1e22; }
  .icon { font-size: 56px; margin: 16px 0; }
</style>
</head>
<body>
<div class="card">
  <span class="badge">⚠️ Dev 模式 (未配 GITHUB_CLIENT_ID)</span>
  <h1>🐙 模拟 GitHub 授权</h1>
  <div class="icon">🐙</div>
  <p>配置 <code>GITHUB_CLIENT_ID</code> + <code>GITHUB_CLIENT_SECRET</code> 环境变量后可接入真 GitHub OAuth 登录。</p>
  <p>现在点下方按钮模拟 GitHub 授权成功</p>
  <form method="POST" action="${new URL(req.url).origin}/tomato/api/github/dev-scan">
    <input type="hidden" name="state" value="${new URL(req.url).searchParams.get("state") || ""}">
    <button class="btn" type="submit">✓ 模拟 GitHub 授权</button>
  </form>
  <a class="close" style="display:block;margin-top:12px;color:#999;font-size:12px;text-decoration:none;" href="${new URL(req.url).origin}/tomato/login/">取消</a>
</div>
</body>
</html>`;
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
