// Client-side fetch wrapper: prepend basePath so URLs work behind /tomato subpath

const BASE_PATH = "/tomato";

export function apiUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_PATH}${normalized}`;
}

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), init);
}

/**
 * 已 parse JSON 的版本: throw 4xx/5xx, 返回 typed data
 */
export async function apiJson<T = any>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(apiUrl(path), init);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as any).error || `http ${r.status}`);
  return data as T;
}
