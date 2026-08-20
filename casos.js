/* ============================================================
   TECNOVA Digital — desenha os projetos reais
   ------------------------------------------------------------
   Lê `casos-config.js` e enche `#casosReais`. Se não houver
   nenhum caso ligado, esconde a secção inteira: mais vale não
   haver nada do que haver um espaço a dizer "em breve", que só
   mostra que ainda não há clientes.
   ============================================================ */
(function () {
  'use strict';

  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
  }

  function desenhar() {
    var caixa = document.getElementById('casosReais');
    if (!caixa) return;

    var lista = (window.TECNOVA_CASOS || []).filter(function (c) {
      // um caso só conta se estiver ligado E tiver para onde apontar
      return c && c.ativo && c.url;
    });

    if (!lista.length) { caixa.remove(); return; }

    caixa.hidden = false;
    caixa.innerHTML =
      '<div class="wrap">' +
        '<p class="eyebrow">' + (lista.length > 1 ? 'Projetos reais' : 'Projeto real') + '</p>' +
        '<h2 class="cr-titulo">Não é uma simulação. Está no ar, ' +
          '<i>com clientes lá dentro.</i></h2>' +
        '<div class="cr-grelha">' +
          lista.map(cartao).join('') +
        '</div>' +
      '</div>';
  }

  function cartao(c) {
    var img = c.imagem
      ? '<a class="browser-frame" href="' + esc(c.url) + '" target="_blank" rel="noopener">' +
          '<div class="bf-bar"><span></span><span></span><span></span></div>' +
          '<div class="bf-shot" style="background-image:url(\'img/casos/' + esc(c.imagem) + '\')"></div>' +
        '</a>'
      : '';

    var feitos = (c.feitos || []).length
      ? '<ul class="cr-feitos">' +
          c.feitos.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') +
        '</ul>'
      : '';

    var dep = c.depoimento
      ? '<blockquote class="cr-dep">' + esc(c.depoimento) +
          (c.quemDisse ? '<cite>' + esc(c.quemDisse) + '</cite>' : '') +
        '</blockquote>'
      : '';

    return '<article class="cr-cartao">' +
        img +
        '<div class="cr-info">' +
          '<span class="cr-selo">✓ Cliente real</span>' +
          '<div class="kicker">' + esc(c.ramo || '') + '</div>' +
          '<h3>' + esc(c.nome) + '</h3>' +
          (c.resumo ? '<p>' + esc(c.resumo) + '</p>' : '') +
          feitos +
          (c.prazo ? '<p class="cr-prazo">' + esc(c.prazo) + '</p>' : '') +
          dep +
          '<a class="btn btn-gold" href="' + esc(c.url) + '" target="_blank" rel="noopener">' +
            'Abrir o site do cliente →</a>' +
        '</div>' +
      '</article>';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', desenhar);
  } else {
    desenhar();
  }
})();
