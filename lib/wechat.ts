/**
 * 微信开放平台 OAuth 2.0 扫码登录
 *
 * 配置 (环境变量):
 * - WECHAT_APP_ID
 * - WECHAT_APP_SECRET
 * - WECHAT_REDIRECT_URI (默认 http://host/tomato/api/wechat/callback)
 *
 * 申请: https://open.weixin.qq.com → 网站应用 → 创建应用 (需企业资质)
 * 文档: https://developers.weixin.qq.com/doc/oplatform/Website_App/WeChat_Login/Wechat_Login.html
 *
 * 没配 env 时 dev 模式: 模拟登录, 生成 dev_openid, 自动建/登 dev 账号
 */

const WECHAT_APP_ID = process.env.WECHAT_APP_ID || "";
const WECHAT_APP_SECRET = process.env.WECHAT_APP_SECRET || "";
export const WECHAT_ENABLED = Boolean(WECHAT_APP_ID && WECHAT_APP_SECRET);

// 微信 OAuth endpoints
const QR_CONNECT_URL = "https://open.weixin.qq.com/connect/qrconnect";
const TOKEN_URL = "https://api.weixin.qq.com/sns/oauth2/access_token";
const USERINFO_URL = "https://api.weixin.qq.com/sns/userinfo";

export type WechatUserInfo = {
  openid: string;
  unionid?: string;
  nickname: string;
  headimgurl: string;
};

/**
 * 生成微信扫码 URL (前端展示二维码用)
 */
export function buildWechatQrUrl(redirectUri: string, state: string): string {
  if (!WECHAT_ENABLED) {
    // dev mode: 跳到 callback, 模拟微信返回 code
    const params = new URLSearchParams({
      dev: "1",
      state,
      redirect_uri: redirectUri,
    });
    return `/tomato/api/wechat/dev-qr?${params.toString()}`;
  }
  const params = new URLSearchParams({
    appid: WECHAT_APP_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "snsapi_login",
    state,
  });
  return `${QR_CONNECT_URL}?${params.toString()}#wechat_redirect`;
}

/**
 * 用 code 换 access_token + openid
 */
export async function exchangeCode(code: string): Promise<{
  access_token: string;
  expires_in: number;
  refresh_token: string;
  openid: string;
  scope: string;
  unionid?: string;
}> {
  const params = new URLSearchParams({
    appid: WECHAT_APP_ID,
    secret: WECHAT_APP_SECRET,
    code,
    grant_type: "authorization_code",
  });
  const r = await fetch(`${TOKEN_URL}?${params.toString()}`);
  if (!r.ok) throw new Error(`wechat token http ${r.status}`);
  const data = await r.json();
  if (data.errcode) {
    throw new Error(`wechat errcode=${data.errcode} errmsg=${data.errmsg}`);
  }
  return data;
}

/**
 * 用 access_token + openid 拿用户信息
 */
export async function fetchWechatUserInfo(
  accessToken: string,
  openid: string
): Promise<WechatUserInfo> {
  const params = new URLSearchParams({
    access_token: accessToken,
    openid,
  });
  const r = await fetch(`${USERINFO_URL}?${params.toString()}`);
  if (!r.ok) throw new Error(`wechat userinfo http ${r.status}`);
  const data = await r.json();
  if (data.errcode) {
    throw new Error(`wechat userinfo errcode=${data.errcode} errmsg=${data.errmsg}`);
  }
  return {
    openid: data.openid,
    unionid: data.unionid,
    nickname: data.nickname || "微信用户",
    headimgurl: data.headimgurl || "",
  };
}

/**
 * 生成 state (CSRF 防护用)
 */
export function generateState(): string {
  return (
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10) +
    Date.now().toString(36)
  );
}

/**
 * Dev mode 用的固定 user info (没配 WECHAT_APP_ID 时)
 */
export function devWechatUserInfo(): WechatUserInfo {
  return {
    openid: "dev_openid_" + Math.random().toString(36).slice(2, 10),
    nickname: "微信测试用户",
    headimgurl: "",
  };
}
