(function tecnovaSplashController() {
  'use strict';

  var root = document.getElementById('tecnova-splash');
  if (!root) return;

  var html = document.documentElement;
  var mode = root.getAttribute('data-mode') || 'session';
  var requestedDuration = Number(root.getAttribute('data-duration')) || 5000;
  var fadeDuration = Number(root.getAttribute('data-fade')) || 480;
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Com "reduzir movimento" ligado a abertura nao gira, e a 1200ms
  // aparecia e desaparecia num piscar de olhos -- parecia avariada.
  // 2600ms chega para se ver o monograma sem prender ninguem.
  var duration = reducedMotion ? Math.min(requestedDuration, 2600) : requestedDuration;
  var sessionKey = 'tecnova:splash:v1';
  var start = performance.now();
  var closed = false;

  function sessionGet(key) {
    try { return window.sessionStorage.getItem(key); } catch (error) { return null; }
  }

  function sessionSet(key, value) {
    try { window.sessionStorage.setItem(key, value); } catch (error) {}
  }

  function removeImmediately() {
    closed = true;
    root.hidden = true;
    root.remove();
    html.classList.remove('tecnova-splash-lock');
    if (window.__tecnovaSplashFailsafe) clearTimeout(window.__tecnovaSplashFailsafe);
  }

  if (mode === 'never' || (mode === 'session' && sessionGet(sessionKey) === 'seen')) {
    removeImmediately();
    return;
  }

  if (mode === 'session') sessionSet(sessionKey, 'seen');

  html.classList.add('tecnova-splash-lock');
  root.hidden = false;
  root.style.setProperty('--tecnova-duration', duration + 'ms');
  root.style.setProperty('--tecnova-fade', fadeDuration + 'ms');

  var lang = (document.documentElement.lang || navigator.language || 'pt').toLowerCase();
  var status = root.querySelector('[data-splash-status]');
  if (status) {
    status.textContent = lang.indexOf('es') === 0
      ? 'Cargando TECNOVA Digital'
      : lang.indexOf('en') === 0
        ? 'Loading TECNOVA Digital'
        : 'A carregar TECNOVA Digital';
  }

  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      root.classList.add('is-running');
      window.dispatchEvent(new CustomEvent('tecnova:splash:shown'));
    });
  });

  function finish() {
    if (closed) return;
    closed = true;
    root.classList.add('is-leaving');
    root.setAttribute('aria-hidden', 'true');

    window.setTimeout(function () {
      root.hidden = true;
      root.remove();
      html.classList.remove('tecnova-splash-lock');
      if (window.__tecnovaSplashFailsafe) clearTimeout(window.__tecnovaSplashFailsafe);
      window.dispatchEvent(new CustomEvent('tecnova:splash:hidden'));
    }, fadeDuration + 60);
  }

  // O fade faz parte dos 5 s pedidos; a soma, e não apenas a espera,
  // termina aproximadamente em data-duration.
  var remaining = Math.max(0, duration - fadeDuration - (performance.now() - start));
  window.setTimeout(finish, remaining);

  // Permite fechar pelo console durante desenvolvimento/QA.
  window.TECNOVA_SPLASH_CLOSE = finish;
})();
