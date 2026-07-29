/* ============================================================
   TECNOVA Digital — idiomas do site
   ------------------------------------------------------------
   O português é a língua original. Cada idioma tem um dicionário
   em `idiomas/` — português → tradução. O que não estiver lá fica
   em português: nunca inventamos traduções.

   Traduz de duas formas, conforme o caso:

   1. AO NÍVEL DO ELEMENTO, quando ele só tem texto e formatação
      inline (<b>, <i>, <span>…). Assim uma frase com negrito no
      meio conta como UMA frase e não como três pedaços partidos.

   2. AO NÍVEL DO TEXTO, no resto.

   Nunca mexe em elementos que tenham `id` lá dentro, porque esses
   são os que o JavaScript agarra (o total do orçamento, o resumo,
   os campos do formulário). Trocar o innerHTML deles partia o site.

   Para acrescentar uma frase: abre `idiomas/en.js` e escreve a
   frase em português como chave, com a tradução ao lado.
   ============================================================ */
window.TecnovaI18N = (function () {
  'use strict';

  var IDIOMAS = {
    pt: { nome: 'Português', bandeira: '🇵🇹', curto: 'PT', htmlLang: 'pt-PT' },
    en: { nome: 'English',   bandeira: '🇬🇧', curto: 'EN', htmlLang: 'en' },
    es: { nome: 'Español',   bandeira: '🇪🇸', curto: 'ES', htmlLang: 'es' }
  };

  var idioma = 'pt';
  var dic = {};
  var aplicando = false;
  var observador = null;

  var IGNORAR = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1 };
  // O <a> não entra: os links são traduzidos por si próprios, senão
  // uma frase inteira com dois botões dentro viraria uma só chave.
  var INLINE = { B: 1, I: 1, EM: 1, STRONG: 1, SPAN: 1, SMALL: 1, U: 1, S: 1, BR: 1,
                 CODE: 1, SUP: 1, SUB: 1 };
  var ALVO = { P: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, LI: 1, BUTTON: 1, A: 1,
               LABEL: 1, TD: 1, TH: 1, SUMMARY: 1, BLOCKQUOTE: 1, OPTION: 1 };
  var ATRIBUTOS = ['placeholder', 'aria-label', 'title'];

  function limpa(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

  function traduz(txt) {
    var k = limpa(txt);
    if (!k || k.length < 2) return null;
    if (dic[k]) return dic[k];
    var m = k.match(/^(.*?)([.!?:;,…]+)$/);
    if (m && dic[m[1]]) return dic[m[1]] + m[2];
    return null;
  }

  /* Um elemento é traduzível inteiro se só tiver formatação inline
     dentro e nenhum descendente com id (esses são do JavaScript). */
  function elementoInteiro(el) {
    if (!ALVO[el.tagName]) return false;
    if (el.querySelector('[id]')) return false;
    // ícones, imagens e campos não se traduzem — e trocar o innerHTML
    // de quem os contém apagava-os
    if (el.querySelector('svg,img,input,select,textarea,canvas')) return false;
    for (var i = 0; i < el.children.length; i++) {
      if (!INLINE[el.children[i].tagName]) return false;
      if (el.children[i].id) return false;
    }
    return el.children.length > 0;   // sem filhos, o modo texto chega
  }

  function traduzirElemento(el) {
    if (el.__i18n_pt === undefined) el.__i18n_pt = el.innerHTML;
    var pt = el.__i18n_pt;
    if (idioma === 'pt') { if (el.innerHTML !== pt) el.innerHTML = pt; return true; }
    var t = traduz(pt);
    var novo = t || pt;
    if (el.innerHTML !== novo) el.innerHTML = novo;
    return true;
  }

  function traduzirTexto(no) {
    if (no.__i18n_pt === undefined) no.__i18n_pt = no.nodeValue;
    var pt = no.__i18n_pt;
    if (idioma === 'pt') { if (no.nodeValue !== pt) no.nodeValue = pt; return; }
    var t = traduz(pt);
    if (t) {
      var antes = pt.match(/^\s*/)[0], depois = pt.match(/\s*$/)[0];
      var novo = antes + t + depois;
      if (no.nodeValue !== novo) no.nodeValue = novo;
    } else if (no.nodeValue !== pt) { no.nodeValue = pt; }
  }

  function percorrer(raiz) {
    var feitos = [];

    // 1. elementos inteiros
    var els = raiz.querySelectorAll('p,h1,h2,h3,h4,h5,li,button,a,label,td,th,summary,blockquote,option');
    Array.prototype.forEach.call(els, function (el) {
      if (el.closest('script,style,[data-sem-traducao]')) return;
      if (!elementoInteiro(el)) return;
      traduzirElemento(el);
      feitos.push(el);
    });

    // 2. o texto que sobrou
    var caminho = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, {
      acceptNode: function (no) {
        var pai = no.parentNode;
        if (!pai || IGNORAR[pai.nodeName]) return NodeFilter.FILTER_REJECT;
        if (pai.closest && pai.closest('[data-sem-traducao]')) return NodeFilter.FILTER_REJECT;
        for (var i = 0; i < feitos.length; i++) {
          if (feitos[i].contains(no)) return NodeFilter.FILTER_REJECT;
        }
        return limpa(no.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var nos = [], n;
    while ((n = caminho.nextNode())) nos.push(n);
    nos.forEach(traduzirTexto);

    // 3. atributos que o utilizador lê
    var todos = raiz.querySelectorAll('[placeholder],[aria-label],[title]');
    Array.prototype.forEach.call(todos, function (el) {
      if (el.closest('[data-sem-traducao]')) return;
      ATRIBUTOS.forEach(function (attr) {
        if (!el.hasAttribute(attr)) return;
        var chave = '__i18n_' + attr;
        if (el[chave] === undefined) el[chave] = el.getAttribute(attr);
        var pt = el[chave];
        var t = (idioma === 'pt') ? pt : (traduz(pt) || pt);
        if (el.getAttribute(attr) !== t) el.setAttribute(attr, t);
      });
    });
  }

  function aplicar(raiz) {
    if (aplicando) return;
    aplicando = true;
    try { percorrer(raiz || document.body); }
    catch (e) { /* nunca deixar o idioma partir a página */ }
    finally { aplicando = false; }
  }

  function observar() {
    if (observador || !window.MutationObserver) return;
    var pendente = null;
    observador = new MutationObserver(function () {
      if (aplicando) return;
      clearTimeout(pendente);
      pendente = setTimeout(function () { aplicar(); }, 80);
    });
    observador.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function definir(codigo) {
    if (!IDIOMAS[codigo]) return;
    idioma = codigo;
    dic = (window.TECNOVA_DIC && window.TECNOVA_DIC[codigo]) || {};
    document.documentElement.lang = IDIOMAS[codigo].htmlLang;
    try { localStorage.setItem('tecnova-idioma', codigo); } catch (e) {}
    aplicar();
    pintarSeletor();
    document.dispatchEvent(new CustomEvent('tecnova:idioma', { detail: codigo }));
  }

  function pintarSeletor() {
    document.querySelectorAll('.lang-btn').forEach(function (b) {
      b.classList.toggle('on', b.dataset.lang === idioma);
    });
    var atual = document.getElementById('langAtual');
    if (atual) atual.textContent = IDIOMAS[idioma].bandeira + ' ' + IDIOMAS[idioma].curto;
  }

  function montarSeletor() {
    if (document.getElementById('langWrap')) return;
    var w = document.createElement('div');
    w.id = 'langWrap';
    w.className = 'lang';
    w.setAttribute('data-sem-traducao', '');
    w.innerHTML =
      '<button class="lang-atual" id="langAtual" aria-haspopup="true" aria-expanded="false"></button>' +
      '<div class="lang-menu" id="langMenu">' +
        Object.keys(IDIOMAS).map(function (k) {
          return '<button class="lang-btn" data-lang="' + k + '">' +
            '<i>' + IDIOMAS[k].bandeira + '</i><span>' + IDIOMAS[k].nome + '</span></button>';
        }).join('') +
      '</div>';

    // Fica dentro do cabeçalho, ao lado do botão — é onde as pessoas o
    // procuram, e assim nunca choca com os botões flutuantes.
    var casa = document.querySelector('header .nav-right') ||
               document.querySelector('.nav .nav-right') ||
               document.querySelector('.nav-right');
    if (casa) { w.classList.add('no-header'); casa.insertBefore(w, casa.firstChild); }
    else { document.body.appendChild(w); }

    var atual = w.querySelector('#langAtual');
    atual.addEventListener('click', function (e) {
      e.stopPropagation();
      var aberto = w.classList.toggle('aberto');
      atual.setAttribute('aria-expanded', aberto ? 'true' : 'false');
    });
    w.querySelector('#langMenu').addEventListener('click', function (e) {
      var b = e.target.closest('.lang-btn'); if (!b) return;
      definir(b.dataset.lang);
      w.classList.remove('aberto');
      atual.setAttribute('aria-expanded', 'false');
    });
    document.addEventListener('click', function () {
      w.classList.remove('aberto');
      atual.setAttribute('aria-expanded', 'false');
    });
    pintarSeletor();
  }

  function iniciar() {
    montarSeletor();
    observar();
    var escolhido = null;
    try {
      var url = new URLSearchParams(location.search).get('lang');
      if (url && IDIOMAS[url]) escolhido = url;
      else {
        var guardado = localStorage.getItem('tecnova-idioma');
        if (guardado && IDIOMAS[guardado]) escolhido = guardado;
      }
    } catch (e) {}
    if (!escolhido) {
      var nav = (navigator.language || 'pt').slice(0, 2).toLowerCase();
      if (IDIOMAS[nav] && nav !== 'pt') escolhido = nav;
    }
    definir(escolhido || 'pt');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();

  return { definir: definir, aplicar: aplicar, idiomas: IDIOMAS,
           atual: function () { return idioma; } };
})();
