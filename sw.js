// Offline cache for the app. Change the version number (v3 -> v4) whenever you edit any file so phones refresh.
const CACHE = 'crossing-assistant-ml-v3';
const PREFIX = 'crossing-assistant-ml-';
const FILES = ['./', './index.html', './warm.html', './lab.js', './ext.js', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png',
  './vendor/tf.min.js', './vendor/tf-tflite.min.js',
  './vendor/tflite_web_api_cc.js', './vendor/tflite_web_api_cc.wasm',
  './vendor/tflite_web_api_cc_simd.js', './vendor/tflite_web_api_cc_simd.wasm'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(FILES.map(f => c.add(f).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
    if (res.ok && new URL(e.request.url).origin === location.origin) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return res;
  })));
});
