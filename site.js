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
})();
