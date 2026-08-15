// Service Worker da TECNOVA Digital
// Estratégia:
//  - Páginas (HTML): network-first — abrem sempre a versão mais recente,
//    usando o cache apenas como reserva quando não há internet.
//  - Restantes ficheiros (CSS/JS/imagens): stale-while-revalidate —
//    abrem rápido a partir do cache e atualizam-se em segundo plano.
const CACHE_NAME = 'tecnova-v24';
const ASSETS = [
  './index.html',
  './servicos.html',
  './pacotes.html',
  './orcamento.html',
  './orcamento.js',
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
  './modelo-confeitaria.html',
  './modelo-confeitaria-catalogo.html',
  './modelo-confeitaria-galeria.html',
  './modelo-confeitaria-sobre.html',
  './modelo-confeitaria-contactos.html',
  './modelo-confeitaria.css',
  './modelo-confeitaria.js',
  './modelo-barbearia-galeria.html',
  './modelo-barbearia-sobre.html',
  './modelo-barbearia-contactos.html',
  './modelo-estetica-galeria.html',
  './modelo-estetica-sobre.html',
  './modelo-estetica-contactos.html',
  './modelo-restaurante-galeria.html',
  './modelo-restaurante-sobre.html',
  './modelo-restaurante-contactos.html',
  './modelo-ginasio-galeria.html',
  './modelo-ginasio-sobre.html',
  './modelo-ginasio-contactos.html',
  './modelo-oficina-galeria.html',
  './modelo-oficina-sobre.html',
  './modelo-oficina-contactos.html',
  './modelo-salao-galeria.html',
  './modelo-salao-sobre.html',
  './modelo-salao-contactos.html',
  './modelo-paginas.css',
  './modelo-carrossel.css',
  './orcamento.css',
  './app-orcamento.css',
  './i18n.js',
  './i18n.css',
  './idiomas/en.js',
  './idiomas/es.js',
  './contacto.html',
  './pagamento.html',
  './pagamento-config.js',
  './assistente.js',
  './assistente.css',
  './chat.js',
  './chat.css',
  './modelo-fix.js',
  './estilo.css',
  './site.js',
  './profile.js',
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
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = req.url;
  // Nunca mexer em pedidos ao Firebase / Google — precisam de estar sempre atualizados.
  if (url.includes('firebase') || url.includes('firebaseio.com') ||
      url.includes('googleapis.com') || url.includes('gstatic.com')) {
    return;
  }

  const isHTML = req.mode === 'navigate' ||
                 (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    // Página: tenta a rede primeiro; só recorre ao cache se estiver offline.
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        return res;
      }).catch(() =>
        caches.match(req).then((c) => c || caches.match('./index.html'))
      )
    );
    return;
  }

  // Outros recursos: serve do cache e atualiza em segundo plano.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
