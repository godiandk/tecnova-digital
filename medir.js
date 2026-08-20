/* ============================================================
   TECNOVA Digital — medição do site
   ------------------------------------------------------------
   Conta quantas pessoas entram e quantas chegam ao fim do
   pedido. Sem isto, pagar anúncios é atirar dinheiro para o
   escuro: não se sabe quantos cliques viraram clientes nem de
   que anúncio vieram.

   NÃO USA COOKIES E NÃO IDENTIFICA NINGUÉM. Guarda só a página,
   o passo do funil e de onde veio a visita. Por isso não precisa
   de aviso de cookies nem de consentimento — não há dados
   pessoais nenhuns aqui.

   A sessão é um número aleatório que vive só no separador aberto
   (sessionStorage). Fecha-se o separador e desaparece. Serve
   apenas para não contar a mesma pessoa dez vezes seguidas.

   O Google Analytics e o pixel do Meta ficam desligados até
   alguém escrever os códigos em `medir-config.js`. Se os ligar,
   aí sim passa a haver cookies de terceiros — e nessa altura
   passa a ser preciso um aviso de cookies no site.
   ============================================================ */
(function () {
  'use strict';

  var CFG = window.TECNOVA_MEDIR || {};
  if (CFG.ativo === false) return;

  /* ---------- de onde veio esta visita ---------- */
  function origem() {
    try {
      var q = new URLSearchParams(location.search);
      var utm = q.get('utm_source');
      if (utm) return utm.slice(0, 40).toLowerCase();
      var r = document.referrer;
      if (!r) return 'direto';
      var h = new URL(r).hostname.replace(/^www\./, '');
      if (h === location.hostname) return '';        // navegação dentro do site
      // agrupar o que é a mesma coisa com nomes diferentes
      if (/google\./.test(h)) return 'google';
      if (/facebook|fb\.|instagram/.test(h)) return 'meta';
      if (/bing\./.test(h)) return 'bing';
      return h.slice(0, 40);
    } catch (e) { return 'direto'; }
  }

  function sessao() {
    try {
      var s = sessionStorage.getItem('tecnova-s');
      if (!s) {
        s = Math.random().toString(36).slice(2, 10);
        sessionStorage.setItem('tecnova-s', s);
        sessionStorage.setItem('tecnova-origem', origem() || 'direto');
      }
      return s;
    } catch (e) { return 'sem-sessao'; }
  }

  function origemDaSessao() {
    try { return sessionStorage.getItem('tecnova-origem') || origem() || 'direto'; }
    catch (e) { return 'direto'; }
  }

  function haFirestore() {
    try { return typeof db !== 'undefined' && !!db; } catch (e) { return false; }
  }

  /* ---------- registar um passo ----------
     `valor` só é usado no pedido feito, para se saber quanto vale
     cada anúncio e não só quantos cliques deu. */
  function registar(tipo, extra) {
    try {
      if (!haFirestore()) return;
      var d = new Date();
      var doc = {
        tipo: String(tipo).slice(0, 30),
        pagina: location.pathname.split('/').pop() || 'index.html',
        origem: origemDaSessao(),
        sessao: sessao(),
        dia: d.getFullYear() + '-' +
             String(d.getMonth() + 1).padStart(2, '0') + '-' +
             String(d.getDate()).padStart(2, '0'),
        quando: d.toISOString()
      };
      if (extra && typeof extra.valor === 'number' && isFinite(extra.valor)) {
        doc.valor = Math.round(extra.valor);
      }
      if (extra && extra.ref) doc.ref = String(extra.ref).slice(0, 40);
      // `.catch` vazio de propósito: se a medição falhar, o site não pode
      // sequer piscar por causa disso. É o menos importante da página.
      db.collection('eventos').add(doc).catch(function () {});
    } catch (e) {}
  }

  /* Uma visita por página e por sessão. Sem isto, quem anda para trás e
     para a frente no site aparecia como dez pessoas diferentes. */
  function visita() {
    try {
      var chave = 'tecnova-v-' + (location.pathname.split('/').pop() || 'index');
      if (sessionStorage.getItem(chave)) return;
      sessionStorage.setItem(chave, '1');
    } catch (e) {}
    registar('visita');
  }

  window.TecnovaMedir = { registar: registar, origem: origemDaSessao };

  /* ---------- Google Analytics e pixel do Meta (opcionais) ----------
     Só entram se alguém escrever os códigos. Enquanto estiverem vazios
     não se carrega nada de fora — o site não fica mais lento nem passa
     a precisar de aviso de cookies. */
  function carregarExternos() {
    if (CFG.googleAnalytics) {
      var g = document.createElement('script');
      g.async = true;
      g.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(CFG.googleAnalytics);
      document.head.appendChild(g);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', CFG.googleAnalytics);
    }
    if (CFG.metaPixel) {
      /* eslint-disable */
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
      (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
      window.fbq('init', CFG.metaPixel);
      window.fbq('track', 'PageView');
      /* eslint-enable */
    }
  }

  /* Manda o mesmo passo para o Google e para o Meta, quando ligados. */
  window.TecnovaMedir.conversao = function (nome, valor, ref) {
    registar(nome, { valor: valor, ref: ref });
    try {
      if (window.gtag) window.gtag('event', nome, { value: valor, currency: 'EUR', transaction_id: ref });
      if (window.fbq) {
        if (nome === 'pedido_feito') window.fbq('track', 'Purchase', { value: valor, currency: 'EUR' });
        else if (nome === 'pedido_comecou') window.fbq('track', 'InitiateCheckout');
        else window.fbq('trackCustom', nome, { value: valor });
      }
    } catch (e) {}
  };

  carregarExternos();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', visita);
  else visita();
})();
