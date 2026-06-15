// Client-side fetch wrapper: prepend basePath so URLs work behind /tomato subpath

const BASE_PATH = "/tomato";

export function apiUrl(path: string): string {
  // 如果 path 已经是 http(s):// 开头，原样返回
  if (/^https?:\/\//.test(path)) return path;
  // 否则确保以 / 开头
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_PATH}${normalized}`;
}

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), init);
}
