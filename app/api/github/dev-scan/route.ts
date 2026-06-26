import { NextResponse } from "next/server";
import { GITHUB_ENABLED } from "@/lib/github";

export async function POST(req: Request) {
  if (GITHUB_ENABLED) {
    return NextResponse.json({ error: "Dev scan 不应在真 GitHub 模式下访问" }, { status: 400 });
  }
  const formData = await req.formData();
  const state = formData.get("state")?.toString() || "";
  const baseUrl = process.env.NEXTAUTH_URL || "http://122.51.221.63/tomato";
  const fakeCode = "dev_" + Math.random().toString(36).slice(2, 12);
  const callbackUrl = `${baseUrl}/api/github/callback?code=${fakeCode}&state=${encodeURIComponent(state)}`;
  return NextResponse.redirect(callbackUrl, { status: 302 });
}
