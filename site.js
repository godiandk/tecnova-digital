/* TECNOVA Digital — interações globais (menu, dropdown e carrossel) */
(function () {
  "use strict";

  /* ---------- Menu mobile (hambúrguer) ---------- */
  var burger = document.getElementById("burger");
  var nav = document.getElementById("navLinks");
  if (burger && nav) {
    burger.addEventListener("click", function () {
      nav.classList.toggle("open");
    });
    nav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        // no telemóvel, tocar no "Modelos" abre o submenu em vez de fechar o menu
        if (a.classList.contains("nav-drop-toggle") &&
            window.matchMedia("(max-width:980px)").matches) return;
        nav.classList.remove("open");
      });
    });
  }

  /* ---------- Dropdown "Modelos" ---------- */
  document.querySelectorAll(".nav-drop-toggle").forEach(function (t) {
    t.addEventListener("click", function (e) {
      if (window.matchMedia("(max-width:980px)").matches) {
        e.preventDefault();
        t.parentElement.classList.toggle("open");
      }
    });
  });

  /* ---------- Carrossel do hero (página inicial) ---------- */
  var slider = document.querySelector(".hero-slider");
  if (slider) {
    var slides = slider.querySelectorAll(".hs-slide");
    var dotsWrap = slider.querySelector(".hs-dots");
    var idx = 0, timer = null, DELAY = 5500;

    /* Os cartazes tem o texto desenhado por dentro, por isso nenhum
       dicionario os traduz: ha tres jogos de quinze, um por lingua, e o
       que muda quando o visitante troca de idioma e o caminho do
       ficheiro. Vale para os que ja estao a vista e para os que ainda
       esperam em data-src. */
    var CAMINHO_LING = /img\/carrossel\/(pt|en|es)\//g;
    document.addEventListener("tecnova:idioma", function (e) {
      var l = e.detail;
      if (l !== "pt" && l !== "en" && l !== "es") return;
      slider.querySelectorAll(".hs-cartaz source, .hs-cartaz img").forEach(function (el) {
        ["srcset", "src", "data-srcset", "data-src"].forEach(function (a) {
          var v = el.getAttribute(a);
          if (v) el.setAttribute(a, v.replace(CAMINHO_LING, "img/carrossel/" + l + "/"));
        });
      });
    });

    /* Cada destaque tem tres cartazes e o mais pesado passa dos 200 KB.
       So o primeiro vem no arranque; os outros guardam os enderecos em
       data-src/data-srcset e so os passam a valer quando lhes chega a
       vez. Sem isto, abrir a pagina puxava cinco cartazes de uma vez
       para mostrar um. */
    function acordar(slide) {
      if (!slide || slide.dataset.acordado) return;
      slide.dataset.acordado = "1";
      slide.querySelectorAll("source[data-srcset], img[data-src]").forEach(function (el) {
        if (el.dataset.srcset) { el.srcset = el.dataset.srcset; delete el.dataset.srcset; }
        if (el.dataset.src) { el.src = el.dataset.src; delete el.dataset.src; }
      });
    }
    acordar(slides[0]);
    /* rede de seguranca: com a pagina ja carregada, o resto vem sozinho,
       para que uma passagem de destaque nunca apanhe um cartaz por vir */
    window.addEventListener("load", function () {
      setTimeout(function () { slides.forEach(acordar); }, 1200);
    });

    if (dotsWrap) {
      slides.forEach(function (_, i) {
        var d = document.createElement("button");
        d.type = "button";
        d.setAttribute("aria-label", "Ir para o destaque " + (i + 1));
        if (i === 0) d.classList.add("active");
        // evita que o foco do botão faça a página saltar/rolar
        d.addEventListener("mousedown", function (e) { e.preventDefault(); });
        d.addEventListener("click", function () { go(i); restart(); });
        dotsWrap.appendChild(d);
      });
    }
    var dots = dotsWrap ? dotsWrap.querySelectorAll("button") : [];

    function go(i) {
      idx = (i + slides.length) % slides.length;
      acordar(slides[idx]);
      acordar(slides[(idx + 1) % slides.length]);
      slides.forEach(function (s, n) { s.classList.toggle("active", n === idx); });
      dots.forEach(function (d, n) { d.classList.toggle("active", n === idx); });
      // cada destaque novo recomeça a contagem à vista
      rearmarBarra();
    }
    function next() { go(idx + 1); }

    /* ---------- parar e voltar a andar ----------
       `pausado` manda em tudo: com ele ligado, nem o rato a sair da zona nem
       um toque nas setas voltam a pôr o carrossel a andar. Se o visitante
       carregou em parar, é porque quer ler. */
    var pausado = false;
    var btnPausa = document.getElementById("hsPausa");

    var barra = document.getElementById("hsBarra");
    var txtPausa = document.getElementById("hsPausaTxt");

    /* A barra enche-se de um destaque para o outro. Antes não havia forma de
       saber se aquilo andava sozinho: ficava-se à espera sem perceber se
       estava parado ou se ainda faltava tempo. */
    function rearmarBarra() {
      if (!barra) return;
      var enchida = barra.firstElementChild;
      barra.classList.remove("anda", "parada");
      barra.style.setProperty("--hs-tempo", DELAY + "ms");
      if (pausado) {
        // congela onde está, em vez de saltar para zero
        var largura = enchida ? enchida.getBoundingClientRect().width : 0;
        var total = barra.getBoundingClientRect().width || 1;
        barra.style.setProperty("--hs-onde", (largura / total * 100) + "%");
        barra.classList.add("parada");
        return;
      }
      // tirar e voltar a pôr a animação obriga-a a recomeçar do zero
      void barra.offsetWidth;
      barra.classList.add("anda");
    }

    function restart() {
      clearInterval(timer);
      if (pausado) { rearmarBarra(); return; }
      timer = setInterval(next, DELAY);
      rearmarBarra();
    }

    function pintarPausa() {
      if (!btnPausa) return;
      var ip = btnPausa.querySelector(".ic-pausa");
      var it = btnPausa.querySelector(".ic-play");
      /* `elemento.hidden = true` só funciona em HTML: a propriedade vive no
         HTMLElement e um <svg> é um SVGElement, que não a tem. Escrevia-se
         a propriedade, não acontecia nada, e o ícone ficava sempre o mesmo
         — era por isso que ninguém percebia se estava parado ou a andar.
         Com o atributo funciona em todo o lado. */
      function esconder(el, sim) {
        if (!el) return;
        if (sim) el.setAttribute("hidden", "");
        else el.removeAttribute("hidden");
      }
      esconder(ip, pausado);
      esconder(it, !pausado);
      btnPausa.setAttribute("aria-pressed", pausado ? "true" : "false");
      // A palavra diz o que o botão FAZ, não em que estado está: é a
      // pergunta que a pessoa faz ao olhar para ele.
      var palavra = pausado ? "Retomar" : "Pausar";
      if (txtPausa) txtPausa.textContent = frase(palavra);
      btnPausa.setAttribute("aria-label", pausado
        ? "Retomar a rotação automática dos destaques"
        : "Parar a rotação automática dos destaques");
    }

    /* O tradutor do site não mexe em elementos com id, e este muda por JS. */
    function frase(pt) {
      try {
        var l = window.TecnovaI18N && window.TecnovaI18N.atual();
        var d = l && window.TECNOVA_DIC && window.TECNOVA_DIC[l];
        return (d && d[pt]) || pt;
      } catch (e) { return pt; }
    }
    window.addEventListener("tecnova:idioma", pintarPausa);

    if (btnPausa) {
      btnPausa.addEventListener("mousedown", function (e) { e.preventDefault(); });
      btnPausa.addEventListener("click", function () {
        pausado = !pausado;
        pintarPausa();
        restart();
      });
    }

    // Quem pediu ao sistema para reduzir animações não quer isto a mexer
    // sozinho. Fica parado, mas com o botão à mão para pôr a andar.
    try {
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        pausado = true;
      }
    } catch (e) {}
    pintarPausa();


    var prev = slider.querySelector(".hs-arrow.prev");
    var nxt = slider.querySelector(".hs-arrow.next");
    if (prev) {
      prev.addEventListener("mousedown", function (e) { e.preventDefault(); });
      prev.addEventListener("click", function () { go(idx - 1); restart(); });
    }
    if (nxt) {
      nxt.addEventListener("mousedown", function (e) { e.preventDefault(); });
      nxt.addEventListener("click", function () { go(idx + 1); restart(); });
    }
    // Com o rato em cima o carrossel espera — e a barra tem de esperar
    // também, senão enchia até ao fim sem nada acontecer.
    slider.addEventListener("mouseenter", function () {
      clearInterval(timer);
      if (!pausado && barra) {
        var e2 = barra.firstElementChild;
        var lg = e2 ? e2.getBoundingClientRect().width : 0;
        var tt = barra.getBoundingClientRect().width || 1;
        barra.style.setProperty("--hs-onde", (lg / tt * 100) + "%");
        barra.classList.remove("anda"); barra.classList.add("parada");
      }
    });
    slider.addEventListener("mouseleave", restart);

    var touchX = null;
    slider.addEventListener("touchstart", function (e) { touchX = e.touches[0].clientX; }, { passive: true });
    slider.addEventListener("touchend", function (e) {
      if (touchX === null) return;
      var dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 45) { go(idx + (dx < 0 ? 1 : -1)); }
      touchX = null;
      restart();
    }, { passive: true });

    restart();
  }

  /* ---------- Instalação da app (PWA) ---------- */
  var deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
  });

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }
  function detectOS() {
    var ua = navigator.userAgent || "";
    if (/iPhone|iPad|iPod/i.test(ua) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
    if (/Android/i.test(ua)) return "android";
    return "desktop";
  }

  /* ------------------------------------------------------------------
     ONDE VIVE O BOTAO APP
     ------------------------------------------------------------------
     Andou a flutuar no canto de baixo a esquerda e nunca deu certo, por
     uma razao geometrica e nao por falta de afinacao: o botao esta preso
     ao fundo da JANELA e a faixa do carrossel anda com a PAGINA. A faixa
     varre o ecra de baixo para cima, do sitio onde comeca ate ao topo,
     por isso passa por cima de QUALQUER ponto fixo que esteja abaixo
     dela. Nao ha altura onde o por que escape -- subi-lo so muda a altura
     de rolar em que os dois se encontram.
     Medido num iPhone de 390x700: a faixa do carrossel ocupa dos 607 aos
     712, e a janela acaba aos 700. Nao sobra canto nenhum. E a bolha do
     chat tambem lhe passa por cima, dos 0 aos 80px de rolar -- so nao se
     nota porque e redonda e calha em cima do canto de um botao.
     Fica no cabecalho. Esta a vista mal a pagina abre, sem ser preciso
     rolar nada, em todas as paginas, e nunca tapa coisa nenhuma.
     ------------------------------------------------------------------ */
  var floatBtn = document.createElement("button");
  floatBtn.type = "button";
  floatBtn.className = "btn-app";
  floatBtn.setAttribute("aria-label", "Instalar a aplicação TECNOVA");
  floatBtn.innerHTML = '<span class="ba-ic" aria-hidden="true">📲</span><span class="ba-txt">APP</span>';
  var caixaTopo = document.querySelector(".nav-right");
  var burger = caixaTopo && caixaTopo.querySelector(".burger");
  if (caixaTopo) caixaTopo.insertBefore(floatBtn, burger);
  else document.body.appendChild(floatBtn);

  var modal = document.createElement("div");
  modal.className = "app-modal";
  modal.hidden = true;
  modal.innerHTML =
    '<div class="app-modal-box">' +
      '<button class="app-modal-close" aria-label="Fechar">×</button>' +
      '<div class="app-modal-logo">T</div>' +
      '<h3>App TECNOVA</h3>' +
      '<p>Aceda à app agora mesmo — sem instalar nada — ou coloque o ícone no seu ecrã.</p>' +
      '<a class="app-open-btn" href="app.html">▶ Abrir app agora</a>' +
      '<div class="app-or"><span>ou instalar no ecrã</span></div>' +
      '<div class="app-choice">' +
        '<button data-os="android"><span class="os-ic">🤖</span>Android / PC</button>' +
        '<button data-os="ios"><span class="os-ic"></span>iPhone / iPad</button>' +
      '</div>' +
      '<div class="app-steps" id="appSteps"></div>' +
    '</div>';
  document.body.appendChild(modal);

  var steps = modal.querySelector("#appSteps");
  var choiceWrap = modal.querySelector(".app-choice");

  function openModal() {
    steps.className = "app-steps";
    steps.innerHTML = "";
    choiceWrap.style.display = "";
    // destaca o sistema detetado
    var os = detectOS();
    modal.querySelectorAll(".app-choice button").forEach(function (b) {
      b.classList.remove("rec");
      var old = b.querySelector(".rec-tag");
      if (old) old.remove();
      var t = b.getAttribute("data-os");
      if ((os === "ios" && t === "ios") || (os !== "ios" && t === "android")) {
        b.classList.add("rec");
        var tag = document.createElement("span");
        tag.className = "rec-tag";
        tag.textContent = "O seu dispositivo";
        b.appendChild(tag);
      }
    });
    modal.hidden = false;
  }
  function closeModal() { modal.hidden = true; }

  floatBtn.addEventListener("click", openModal);

  /* A altura dos comandos vai para o CSS. Abaixo dos 380px eles passam a
     duas filas e ficam com o dobro da altura; sem isto, os botoes do
     destaque continuavam a assentar em cima deles. */
  (function () {
    var palco = document.querySelector(".hero-slider");
    var cmds = document.querySelector(".hs-comandos");
    if (!palco || !cmds) return;
    function medir() {
      palco.style.setProperty("--cmd-h", Math.round(cmds.getBoundingClientRect().height) + "px");
    }
    medir();
    window.addEventListener("resize", medir);
    if (window.ResizeObserver) new ResizeObserver(medir).observe(cmds);
  })();

  document.querySelectorAll(".js-open-app").forEach(function (el) {
    el.addEventListener("click", function (e) { e.preventDefault(); openModal(); });
  });
  modal.querySelector(".app-modal-close").addEventListener("click", closeModal);
  modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });

  function showSteps(html) {
    choiceWrap.style.display = "none";
    steps.innerHTML = html + '<button class="app-back" type="button">← Voltar</button>';
    steps.classList.add("show");
    steps.querySelector(".app-back").addEventListener("click", openModal);
  }

  function androidFlow() {
    if (isStandalone()) {
      showSteps('<div class="app-ok">✅ A app já está instalada neste dispositivo. Abra-a pelo ícone TECNOVA no seu ecrã.</div>');
      return;
    }
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function (r) {
        if (r.outcome === "accepted") {
          showSteps('<div class="app-ok">🎉 App instalada! Procure o ícone TECNOVA no seu ecrã inicial / área de trabalho.</div>');
        } else {
          showSteps('<div class="app-warn">Sem problema — pode instalar quando quiser, tocando novamente no botão APP.</div>');
        }
        deferredPrompt = null;
      });
    } else {
      showSteps(
        '<div class="app-warn">O seu navegador pode instalar em 1 passo:</div>' +
        '<ol><li><b>Android (Chrome):</b> toque no menu <b>⋮</b> → <b>“Instalar aplicação”</b>.</li>' +
        '<li><b>PC (Chrome/Edge):</b> clique no ícone <b>⊕ / instalar</b> na barra de endereço → <b>Instalar</b>.</li></ol>' +
        '<p style="color:var(--cream-dim);font-size:.85rem;margin-top:8px">O ícone da TECNOVA fica no ecrã como uma app normal.</p>'
      );
    }
  }

  function iosFlow() {
    if (isStandalone()) {
      showSteps('<div class="app-ok">✅ Já está a usar a app TECNOVA. 🎉</div>');
      return;
    }
    showSteps(
      '<p style="color:var(--cream-dim);font-size:.88rem;margin-bottom:10px">No iPhone/iPad, a Apple não permite instalar automaticamente — faça em 2 passos rápidos no <b>Safari</b>:</p>' +
      '<ol><li>Toque no botão <b>Partilhar</b> (o quadrado com uma seta ↑) na barra do Safari.</li>' +
      '<li>Deslize e escolha <b>“Adicionar ao ecrã principal”</b> e confirme em <b>Adicionar</b>.</li></ol>' +
      '<div class="app-ok" style="margin-top:12px">Pronto — o ícone da TECNOVA fica no seu ecrã como uma app. 🎉</div>'
    );
  }

  modal.querySelectorAll(".app-choice button").forEach(function (b) {
    b.addEventListener("click", function () {
      if (b.getAttribute("data-os") === "ios") iosFlow(); else androidFlow();
    });
  });
})();
