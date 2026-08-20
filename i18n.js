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
    return porPadrao(k);
  }

  /* Frases que o JavaScript monta com números lá dentro ("≈ 2,5 horas de
     trabalho", "9 itens") nunca podem ser uma chave do dicionário. Cada
     idioma traz por isso a sua lista de padrões em `__padroes`. */
  function porPadrao(k) {
    var ps = dic.__padroes;
    if (!ps) return null;
    for (var i = 0; i < ps.length; i++) {
      var m = k.match(new RegExp(ps[i][0]));
      if (!m) continue;
      return ps[i][1].replace(/\$(\d)/g, function (_, n) { return m[+n] || ''; });
    }
    return null;
  }

  /* Um elemento é traduzível inteiro se só tiver formatação inline
     dentro e nenhum descendente com id (esses são do JavaScript). */
  function elementoInteiro(el) {
    if (!ALVO[el.tagName]) return false;
    // Um elemento com `id` é, quase sempre, um elemento que o JavaScript
    // reescreve (a nota de câmbio, o total, a barra da campanha). Se
    // guardássemos aqui o innerHTML, ficava preso no primeiro valor: trocava-se
    // de moeda e a nota continuava a mostrar a moeda anterior. Nesses casos
    // traduz-se texto a texto, que acompanha as reescritas.
    if (el.id || el.querySelector('[id]')) return false;
    // ícones, imagens e campos não se traduzem — e trocar o innerHTML
    // de quem os contém apagava-os
    if (el.querySelector('svg,img,input,select,textarea,canvas')) return false;
    for (var i = 0; i < el.children.length; i++) {
      if (!INLINE[el.children[i].tagName]) return false;
      if (el.children[i].id) return false;
    }
    return el.children.length > 0;   // sem filhos, o modo texto chega
  }

  /* Traduz o elemento inteiro, mas so quando o dicionario conhece a frase toda.
     Devolve `true` se ficou tratado aqui; `false` manda o caso para o modo
     texto, que e o mais seguro porque acompanha as reescritas do JavaScript.

     Regra que nao se quebra: NUNCA reescrevemos o elemento com o original
     guardado por nossa iniciativa. Se o JavaScript da pagina mudou um preco la
     dentro, escrever de volta a copia antiga apagava-o - foi o que fazia a nota
     de cambio ficar presa na primeira moeda escolhida. So desfazemos aquilo que
     fomos nos a fazer, e isso fica marcado em `__i18n_traduzido`. */
  function traduzirElemento(el) {
    if (el.__i18n_pt === undefined) el.__i18n_pt = el.innerHTML;
    var pt = el.__i18n_pt;

    if (idioma === 'pt') {
      if (!el.__i18n_traduzido) return false;      // nunca lhe tocamos
      if (el.innerHTML !== pt) el.innerHTML = pt;  // desfazer a nossa traducao
      el.__i18n_traduzido = false;
      return true;
    }

    var t = traduz(pt);
    if (t) {
      if (el.innerHTML !== t) el.innerHTML = t;
      el.__i18n_traduzido = true;
      return true;
    }

    // Sem traducao para a frase inteira. Se ja esteve traduzido por nos (por
    // exemplo, trocou-se de ingles para espanhol), repoe-se o portugues antes
    // de o entregar ao modo texto.
    if (el.__i18n_traduzido) {
      if (el.innerHTML !== pt) el.innerHTML = pt;
      el.__i18n_traduzido = false;
    }
    return false;
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
      // so entra nos "feitos" quem ficou mesmo resolvido aqui; o resto segue
      // para o modo texto, que traduz pedaco a pedaco e respeita os precos
      if (traduzirElemento(el)) feitos.push(el);
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

  /* ------------------------------------------------------------------
     O titulo do separador e a descricao da pagina
     ------------------------------------------------------------------
     Traduzia-se a pagina toda e ficava "TECNOVA Digital - Sites & Apps
     que trabalham por si" escrito no separador do navegador, em
     portugues, com a pagina em ingles. Fica mal e confunde quem guarda
     nos favoritos.
     Guardamos os originais na primeira passagem: sem isso, ao voltar
     para portugues ja nao havia por onde voltar.
     ATENCAO ao que isto NAO resolve: quando alguem partilha a ligacao
     no Facebook ou no WhatsApp, quem la vai buscar o texto nao corre
     JavaScript nenhum -- le o HTML como esta no ficheiro. Por isso a
     pre-visualizacao continua em portugues. Para isso ser diferente
     eram precisos enderecos proprios (/en/, /es/), que e outro
     trabalho.
     ------------------------------------------------------------------ */
  var METAS = [
    ['title',                       null],
    ['meta[name="description"]',    'content'],
    ['meta[property="og:title"]',   'content'],
    ['meta[property="og:description"]', 'content'],
    ['meta[name="twitter:title"]',  'content'],
    ['meta[name="twitter:description"]', 'content']
  ];
  var originais = null;

  function traduzirCabeca() {
    if (!originais) {
      originais = METAS.map(function (m) {
        var el = document.querySelector(m[0]);
        if (!el) return null;
        return m[1] ? el.getAttribute(m[1]) : el.textContent;
      });
    }
    METAS.forEach(function (m, i) {
      var el = document.querySelector(m[0]);
      var orig = originais[i];
      if (!el || orig == null) return;
      // o que nao estiver traduzido fica em portugues -- nunca se inventa
      var novo = dic[orig] || orig;
      if (m[1]) el.setAttribute(m[1], novo); else el.textContent = novo;
    });
    var loc = document.querySelector('meta[property="og:locale"]');
    if (loc && IDIOMAS[idioma].htmlLang) {
      loc.setAttribute('content', IDIOMAS[idioma].htmlLang.replace('-', '_'));
    }
  }

  function definir(codigo) {
    if (!IDIOMAS[codigo]) return;
    idioma = codigo;
    dic = (window.TECNOVA_DIC && window.TECNOVA_DIC[codigo]) || {};
    document.documentElement.lang = IDIOMAS[codigo].htmlLang;
    try { localStorage.setItem('tecnova-idioma', codigo); } catch (e) {}
    aplicar();
    traduzirCabeca();
    pintarSeletor();
    document.dispatchEvent(new CustomEvent('tecnova:idioma', { detail: codigo }));
  }

  function pintarSeletor() {
    document.querySelectorAll('.lang-btn').forEach(function (b) {
      b.classList.toggle('on', b.dataset.lang === idioma);
    });
    var atual = document.getElementById('langAtual');
    if (atual) {
      // bandeira e nome em elementos próprios: em ecrãs estreitos o CSS
      // esconde o nome e fica só a bandeira, sem apertar a barra de topo
      atual.innerHTML = '<i class="la-bandeira"></i><span class="la-nome"></span>';
      atual.querySelector('.la-bandeira').textContent = IDIOMAS[idioma].bandeira;
      atual.querySelector('.la-nome').textContent = IDIOMAS[idioma].nome;
      // Em ecrãs estreitos o nome por extenso não cabe e empurrava o menu
      // para fora. Aí mostra-se só isto, por CSS.
      atual.setAttribute('data-curto', IDIOMAS[idioma].curto);
      // A etiqueta do próprio seletor também é lida por quem não vê o ecrã,
      // e não fazia sentido ficar em português depois de trocar de idioma.
      var rotulo = { pt: 'Idioma', en: 'Language', es: 'Idioma' }[idioma] || 'Idioma';
      atual.setAttribute('aria-label', rotulo + ': ' + IDIOMAS[idioma].nome);
    }
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
    else {
      // Na aplicação não há `.nav-right`; a barra de topo serve na mesma, e
      // assim não fica em cima da barra de abas lá em baixo.
      var barra = document.querySelector('header.app-bar');
      if (barra) {
        w.classList.add('no-header', 'na-app-bar');
        var avatar = barra.querySelector('.ab-avatar');
        if (avatar) barra.insertBefore(w, avatar); else barra.appendChild(w);
      } else { document.body.appendChild(w); }
    }

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
