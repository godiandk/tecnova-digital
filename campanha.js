/* ============================================================
   TECNOVA Digital — a campanha, num sítio só
   ------------------------------------------------------------
   ISTO É A ÚNICA FONTE DA VERDADE sobre a campanha. Mude aqui a
   data ou a percentagem e muda em todo o site de uma vez.

   PORQUE É QUE ISTO EXISTE
   ------------------------
   A data estava escrita à mão em meia dúzia de sítios do HTML,
   mas quem decidia se o desconto se aplicava era o código do
   pedido. No dia seguinte ao fim da campanha, a página inicial
   continuava a prometer «40% até 30 de setembro» e o pedido
   cobrava o preço cheio — a pessoa clicava num anúncio a
   prometer desconto e apanhava mais 40% na conta.

   COMO SE USA NO HTML
   -------------------
     <div data-promo>            some quando a campanha acabar
     <div data-promo-fora hidden> aparece quando a campanha acabar
     <span data-promo-fim>        escreve "30 de setembro"
     <span data-promo-pct>        escreve "40%"
     <span data-promo-codigo>     escreve "INOVA40"
     <span data-promo-dias>       escreve quantos dias faltam
     <b data-promo-preco="650">   escreve "390€" (o preço com a campanha)

   O último existe para a página dos Pacotes: os preços de tabela
   estavam lá sozinhos, sem dizer se já tinham ou não o desconto.
   Escrevendo-os aqui, mudam sozinhos com a percentagem e nunca
   ficam a contradizer o que o pedido cobra.
   ============================================================ */
window.TECNOVA_PROMO = {
  ativo: true,
  fim: '2026-09-30',        // último dia, inclusive (AAAA-MM-DD)
  desconto: 0.40,           // 40% sobre o valor total do site
  codigo: 'INOVA40',
  mesGratis: true           // 1.ª mensalidade da avença grátis
};

(function () {
  'use strict';
  var P = window.TECNOVA_PROMO;
  var MESES = ['janeiro','fevereiro','março','abril','maio','junho',
               'julho','agosto','setembro','outubro','novembro','dezembro'];

  function ativa() {
    if (!P.ativo) return false;
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    return hoje <= new Date(P.fim + 'T23:59:59');
  }
  function diasQueFaltam() {
    return Math.max(0, Math.ceil((new Date(P.fim + 'T23:59:59') - new Date()) / 86400000));
  }
  function porExtenso() {
    var p = P.fim.split('-');
    return Number(p[2]) + ' de ' + MESES[Number(p[1]) - 1];
  }

  P.ativa = ativa;
  P.diasQueFaltam = diasQueFaltam;
  P.fimPorExtenso = porExtenso;

  function pintar() {
    var viva = ativa();
    try {
      document.querySelectorAll('[data-promo]').forEach(function (el) { el.hidden = !viva; });

      document.querySelectorAll('[data-promo-fora]').forEach(function (el) { el.hidden = viva; });
      if (!viva) return;    // com a campanha acabada não vale a pena escrever datas
      document.querySelectorAll('[data-promo-fim]').forEach(function (el) { el.textContent = porExtenso(); });
      document.querySelectorAll('[data-promo-pct]').forEach(function (el) { el.textContent = Math.round(P.desconto * 100) + '%'; });
      document.querySelectorAll('[data-promo-codigo]').forEach(function (el) { el.textContent = P.codigo; });
      document.querySelectorAll('[data-promo-dias]').forEach(function (el) { el.textContent = diasQueFaltam(); });
      document.querySelectorAll('[data-promo-preco]').forEach(function (el) {
        var normal = Number(el.getAttribute('data-promo-preco'));
        if (!isFinite(normal) || normal <= 0) return;
        el.textContent = Math.round(normal * (1 - P.desconto)) + '\u20ac';
      });
    } catch (e) {}
  }

  /* Tirar o destaque da campanha tem de acontecer JA, nao no
     DOMContentLoaded: o carrossel do site.js conta os destaques para fazer
     as bolinhas, e se esperassemos ficavam cinco bolinhas para quatro
     destaques. Como este ficheiro vem no HTML antes do site.js, e o
     carrossel esta escrito acima dos dois, os destaques ja ca estao. */
  (function tirarDestaqueDaCampanha() {
    try {
      if (ativa()) return;
      var fora = document.querySelectorAll('[data-promo-slide]');
      if (!fora.length) return;
      fora.forEach(function (el) {
        var irmao = el.parentNode &&
                    el.parentNode.querySelector('.hs-slide:not([data-promo-slide])');
        if (irmao) irmao.classList.add('active');
        el.remove();
      });
    } catch (e) {}
  })();

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pintar);
  else pintar();
})();
