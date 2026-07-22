// Service Worker da TECNOVA Digital
// Guarda o essencial em cache para o site abrir rápido e funcionar como app.
const CACHE_NAME = 'tecnova-v1';
const ASSETS = [
  './index.html',
  './servicos.html',
  './pacotes.html',
  './modelos.html',
  './renovacao.html',
  './sobre.html',
  './conta.html',
  './modelo-barbearia.html',
  './modelo-estetica.html',
  './modelo-restaurante.html',
  './modelo-ginasio.html',
  './modelo-oficina.html',
  './modelo-salao.html',
  './estilo.css',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Nunca guardar em cache pedidos ao Firebase — precisam de estar sempre atualizados.
  if (event.request.url.includes('firebaseio.com') ||
      event.request.url.includes('googleapis.com') ||
      event.request.url.includes('firebase')) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
