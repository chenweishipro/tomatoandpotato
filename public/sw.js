// 番茄土豆 Service Worker - 极简离线壳
const CACHE = "tomato-v1";
const SHELL = ["/tomato/", "/tomato/login/", "/tomato/app/"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // 仅处理同源 GET
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  // 网络优先，失败回退 cache
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || new Response("Offline", { status: 503 })))
  );
});