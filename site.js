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

    if (dotsWrap) {
      slides.forEach(function (_, i) {
        var d = document.createElement("button");
        d.type = "button";
        d.setAttribute("aria-label", "Ir para o destaque " + (i + 1));
        if (i === 0) d.classList.add("active");
        d.addEventListener("click", function () { go(i); restart(); });
        dotsWrap.appendChild(d);
      });
    }
    var dots = dotsWrap ? dotsWrap.querySelectorAll("button") : [];

    function go(i) {
      idx = (i + slides.length) % slides.length;
      slides.forEach(function (s, n) { s.classList.toggle("active", n === idx); });
      dots.forEach(function (d, n) { d.classList.toggle("active", n === idx); });
    }
    function next() { go(idx + 1); }
    function restart() { clearInterval(timer); timer = setInterval(next, DELAY); }

    var prev = slider.querySelector(".hs-arrow.prev");
    var nxt = slider.querySelector(".hs-arrow.next");
    if (prev) prev.addEventListener("click", function () { go(idx - 1); restart(); });
    if (nxt) nxt.addEventListener("click", function () { go(idx + 1); restart(); });
    slider.addEventListener("mouseenter", function () { clearInterval(timer); });
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

  // Injeta o botão flutuante "APP" e o modal em todas as páginas
  var floatBtn = document.createElement("button");
  floatBtn.type = "button";
  floatBtn.className = "app-float";
  floatBtn.setAttribute("aria-label", "Instalar a app TECNOVA");
  floatBtn.innerHTML = '<span class="af-ic">📲</span> APP';
  document.body.appendChild(floatBtn);

  var modal = document.createElement("div");
  modal.className = "app-modal";
  modal.hidden = true;
  modal.innerHTML =
    '<div class="app-modal-box">' +
      '<button class="app-modal-close" aria-label="Fechar">×</button>' +
      '<div class="app-modal-logo">T</div>' +
      '<h3>Instalar a app TECNOVA</h3>' +
      '<p>Adicione o nosso site ao seu ecrã como uma aplicação — sem loja, sem download.</p>' +
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
