// わが子ドリル工房 — オフラインでも開けるように、画面の部品をキャッシュする
// 中身を変えたら CACHE の番号を上げる（公開版の確認もこの番号で行う）
const CACHE = 'wagako-v1';
const ASSETS = ['./', 'index.html', 'style.css', 'parser.js', 'samples.js', 'app.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  // ブラウザの HTTP キャッシュ（Pages は約10分）を通さず、最新を取り直してから入れる
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('wagako-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // 画面（HTML）はネットを先に見て、つながらないときだけキャッシュ。部品はキャッシュを先に使う
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request).then((hit) => hit || caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
