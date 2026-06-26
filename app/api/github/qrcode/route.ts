import { NextResponse } from "next/server";
import { buildGithubAuthUrl, generateState, GITHUB_ENABLED } from "@/lib/github";

export async function GET() {
  const baseUrl = process.env.NEXTAUTH_URL || "http://122.51.221.63/tomato";
  const callbackUrl = `${baseUrl}/api/github/callback`;
  const state = generateState();
  const url = buildGithubAuthUrl(callbackUrl, state);
  return NextResponse.json({
    url,
    state,
    enabled: GITHUB_ENABLED,
    dev: !GITHUB_ENABLED,
  });
}
