/* Doce Aurora — comportamento partilhado do modelo (TECNOVA Digital) */

/* menu mobile */
(function () {
  var burger = document.getElementById('burger');
  var navLinks = document.getElementById('navLinks');
  if (!burger || !navLinks) return;
  burger.addEventListener('click', function () { navLinks.classList.toggle('open'); });
  navLinks.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () { navLinks.classList.remove('open'); });
  });
})();

/* carrossel do início */
(function () {
  var slider = document.querySelector('.hero-slider');
  if (!slider) return;
  var slides = slider.querySelectorAll('.hs-slide');
  var dotsWrap = slider.querySelector('.hs-dots');
  var prev = slider.querySelector('.hs-arrow.prev');
  var next = slider.querySelector('.hs-arrow.next');
  if (slides.length < 2) {
    if (prev) prev.style.display = 'none';
    if (next) next.style.display = 'none';
    return;
  }
  var idx = 0, timer = null, DELAY = 6000;

  if (dotsWrap) {
    slides.forEach(function (_, i) {
      var d = document.createElement('button');
      d.type = 'button';
      d.setAttribute('aria-label', 'Ir para o destaque ' + (i + 1));
      if (i === 0) d.classList.add('active');
      d.addEventListener('mousedown', function (e) { e.preventDefault(); });
      d.addEventListener('click', function () { go(i); restart(); });
      dotsWrap.appendChild(d);
    });
  }
  var dots = dotsWrap ? dotsWrap.querySelectorAll('button') : [];

  function go(i) {
    idx = (i + slides.length) % slides.length;
    slides.forEach(function (s, n) { s.classList.toggle('active', n === idx); });
    dots.forEach(function (d, n) { d.classList.toggle('active', n === idx); });
  }
  function nextSlide() { go(idx + 1); }
  function restart() { clearInterval(timer); timer = setInterval(nextSlide, DELAY); }

  if (prev) {
    prev.addEventListener('mousedown', function (e) { e.preventDefault(); });
    prev.addEventListener('click', function () { go(idx - 1); restart(); });
  }
  if (next) {
    next.addEventListener('mousedown', function (e) { e.preventDefault(); });
    next.addEventListener('click', function () { go(idx + 1); restart(); });
  }
  slider.addEventListener('mouseenter', function () { clearInterval(timer); });
  slider.addEventListener('mouseleave', restart);

  var touchX = null;
  slider.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
  slider.addEventListener('touchend', function (e) {
    if (touchX === null) return;
    var dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 45) go(idx + (dx < 0 ? 1 : -1));
    touchX = null;
    restart();
  }, { passive: true });

  restart();
})();

/* animação de entrada */
(function () {
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: .1 });
  document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
})();
