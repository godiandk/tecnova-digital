/* ============================================================
   Vida Financeira — service worker

   Objectivo: a app abrir sem internet. Guardamos os ficheiros do
   próprio site em cache e servimo-los de lá.

   Estratégia:
   - páginas (navegação): rede primeiro, cache se falhar
     (para uma versão nova chegar assim que houver rede)
   - resto (css, js, ícones): cache primeiro, rede em segundo plano
     (para abrir instantaneamente)

   O Firebase e as fontes do Google NÃO são postos em cache: são de
   outro domínio e têm de ir sempre à rede.
   ============================================================ */

const VERSAO = 'vida-financeira-v1';

const FICHEIROS = [
  './',
  './index.html',
  './app.html',
  './conta.html',
  './sobre.html',
  './estilo.css',
  './app-financas.css',
  './app-financas.js',
  './site.js',
  './firebase-config.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', ev => {
  ev.waitUntil(
    caches.open(VERSAO)
      // `addAll` falha inteiro se um único ficheiro faltar. Guardamos
      // um a um para uma falha isolada não deixar a app sem cache.
      .then(cache => Promise.all(
        FICHEIROS.map(f => cache.add(f).catch(() => null))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys()
      .then(chaves => Promise.all(
        chaves.filter(c => c !== VERSAO).map(c => caches.delete(c))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', ev => {
  const req = ev.request;

  if (req.method !== 'GET') return;

  // Outro domínio (Firebase, fontes): passa directo para a rede.
  if (new URL(req.url).origin !== self.location.origin) return;

  // Páginas: rede primeiro.
  if (req.mode === 'navigate') {
    ev.respondWith(
      fetch(req)
        .then(res => {
          const copia = res.clone();
          caches.open(VERSAO).then(c => c.put(req, copia));
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./app.html')))
    );
    return;
  }

  // Ficheiros do site: cache primeiro.
  ev.respondWith(
    caches.match(req).then(guardado => {
      const daRede = fetch(req)
        .then(res => {
          const copia = res.clone();
          caches.open(VERSAO).then(c => c.put(req, copia));
          return res;
        })
        .catch(() => guardado);
      return guardado || daRede;
    })
  );
});
