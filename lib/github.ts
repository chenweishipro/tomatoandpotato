/**
 * GitHub OAuth 2.0 登录
 *
 * 配置 (env):
 * - GITHUB_CLIENT_ID
 * - GITHUB_CLIENT_SECRET
 * - GITHUB_REDIRECT_URI (默认 http://host/tomato/api/auth/github/callback)
 *
 * 没配 env 时 dev 模式: 模拟 GitHub 登录, 生成 dev_github_id, 自动建/登 dev 账号
 *
 * 申请: https://github.com/settings/developers → New OAuth App
 *   Authorization callback URL: <GITHUB_REDIRECT_URI>
 */

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || "";
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || "";
export const GITHUB_ENABLED = Boolean(GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET);

const AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const TOKEN_URL = "https://github.com/login/oauth/access_token";
const USERINFO_URL = "https://api.github.com/user";
const EMAILS_URL = "https://api.github.com/user/emails";

export type GithubUserInfo = {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
};

/**
 * 生成 GitHub OAuth 授权 URL (前端展示扫码/跳转按钮用)
 */
export function buildGithubAuthUrl(redirectUri: string, state: string): string {
  if (!GITHUB_ENABLED) {
    // dev mode: 跳到自己的 dev-qr 页面
    const params = new URLSearchParams({ state, redirect_uri: redirectUri });
    return `/tomato/api/auth/github/dev-qr?${params.toString()}`;
  }
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: "read:user user:email",
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * 用 code 换 access_token
 */
export async function exchangeGithubCode(code: string): Promise<string> {
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: "",
    }).toString(),
  });
  if (!r.ok) throw new Error(`github token http ${r.status}`);
  const data = (await r.json()) as { access_token?: string; error?: string; error_description?: string };
  if (data.error) {
    throw new Error(`github oauth: ${data.error} ${data.error_description || ""}`);
  }
  if (!data.access_token) throw new Error("github oauth: no access_token in response");
  return data.access_token;
}

/**
 * 用 access_token 拿用户信息
 */
export async function fetchGithubUserInfo(accessToken: string): Promise<GithubUserInfo> {
  const r = await fetch(USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "User-Agent": "tomato-app",
    },
  });
  if (!r.ok) throw new Error(`github userinfo http ${r.status}`);
  const data = (await r.json()) as GithubUserInfo;

  // 如果 user.email 是 null (user 隐藏 email), 拉 emails list 找 primary
  if (!data.email) {
    const er = await fetch(EMAILS_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "User-Agent": "tomato-app",
      },
    });
    if (er.ok) {
      const emails = (await er.json()) as Array<{ email: string; primary: boolean; verified: boolean }>;
      const primary = emails.find((e) => e.primary && e.verified);
      if (primary) data.email = primary.email;
    }
  }
  return data;
}

/**
 * 生成 state (CSRF 防护)
 */
export function generateState(): string {
  return (
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10) +
    Date.now().toString(36)
  );
}

/**
 * Dev mode 用的固定 user info (没配 GITHUB_CLIENT_ID 时)
 */
export function devGithubUserInfo(): GithubUserInfo {
  return {
    id: Math.floor(Math.random() * 100000000),
    login: "dev_github_user",
    name: "GitHub Dev User",
    email: "github_dev@example.com",
    avatar_url: "",
  };
}