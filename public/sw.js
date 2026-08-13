const CACHE = "shop-media-v2";
const MAX_ENTRIES = 400;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) =>
  e.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  ),
);

async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_ENTRIES) return;
  await Promise.all(keys.slice(0, keys.length - MAX_ENTRIES).map((k) => cache.delete(k)));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || req.headers.has("range")) return;
  const url = new URL(req.url);
  if (url.pathname.startsWith("/~oauth") || url.pathname.startsWith("/_serverFn")) return;
  const isMedia =
    /\.(png|jpg|jpeg|webp|gif|mp4|webm|avif)$/i.test(url.pathname) ||
    url.pathname.includes("/storage/v1/object/sign/");
  if (!isMedia) return;

  // straight from the phone when it is already there; refreshed quietly in the background
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) {
        event.waitUntil(
          fetch(req)
            .then(async (res) => {
              if (res.ok) {
                await cache.put(req, res.clone());
                await trim(cache);
              }
            })
            .catch(() => {}),
        );
        return hit;
      }
      try {
        const res = await fetch(req);
        if (res.ok) {
          await cache.put(req, res.clone());
          await trim(cache);
        }
        return res;
      } catch (err) {
        const stale = await cache.match(req, { ignoreSearch: true });
        if (stale) return stale;
        throw err;
      }
    }),
  );
});
