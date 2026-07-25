/* TECNOVA — evita que o cabeçalho do modelo fique escondido atrás da barra
   fixa "modelo demonstrativo" (que muda de altura conforme a largura do ecrã). */
(function () {
  function fit() {
    var bar = document.querySelector('.demo-bar');
    if (!bar) return;
    var h = bar.offsetHeight;
    var header = document.querySelector('header');
    if (header) header.style.paddingTop = h + 'px';
    var cat = document.querySelector('.cat-nav'); // páginas de cardápio/preçário
    if (cat) cat.style.top = h + 'px';
  }
  fit();
  window.addEventListener('load', fit);
  window.addEventListener('resize', fit);
  // as fontes web podem mudar a altura da barra depois do 1.º cálculo
  setTimeout(fit, 300);
})();
