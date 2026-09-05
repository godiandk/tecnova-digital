/* ============================================================
   Vida Financeira — comportamento partilhado por todas as páginas
   (menu, ano do rodapé, animações, estado da conta, PWA)
   ============================================================ */

/* ---------- menu do telemóvel ---------- */
(function menu() {
  const burger = document.getElementById('burger');
  const links = document.getElementById('menu');
  if (!burger || !links) return;

  burger.addEventListener('click', () => {
    const aberto = links.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(aberto));
  });

  // Tocar numa entrada fecha o painel — senão fica aberto por cima da página
  // seguinte durante a navegação.
  links.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      links.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
    });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      links.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
    }
  });
})();

/* ---------- ano do rodapé ---------- */
(function ano() {
  document.querySelectorAll('#ano').forEach(el => {
    el.textContent = new Date().getFullYear();
  });
})();

/* ---------- animação de entrada ---------- */
(function reveal() {
  const alvos = document.querySelectorAll('.reveal');
  if (!alvos.length) return;

  if (!('IntersectionObserver' in window)) {
    alvos.forEach(el => el.classList.add('in'));
    return;
  }

  const obs = new IntersectionObserver((entradas) => {
    entradas.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });

  alvos.forEach(el => obs.observe(el));
})();

/* ---------- "Entrar / Criar conta" passa a nome quando há sessão ---------- */
(function navConta() {
  const link = document.getElementById('nav-conta');
  if (!link || typeof firebase === 'undefined' || !window.auth) return;

  auth.onAuthStateChanged(u => {
    if (!u) {
      link.textContent = 'Entrar / Criar conta';
      link.className = link.className.replace('nav-account', '').trim();
      link.href = 'conta.html';
      return;
    }
    const nome = u.displayName || (u.email || '').split('@')[0] || 'A minha conta';
    link.href = 'conta.html';
    link.classList.add('nav-account');
    link.textContent = '';

    const av = document.createElement('span');
    av.className = 'nav-avatar';
    av.textContent = nome.charAt(0).toUpperCase();

    const txt = document.createElement('span');
    txt.textContent = nome;

    link.append(av, txt);
  });
})();

/* ---------- PWA ---------- */
(function pwa() {
  if (!('serviceWorker' in navigator)) return;
  // Em `file://` o registo rebenta sempre — só faz sentido em http(s).
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
})();

/* ---------- modal "instalar como app" ---------- */
(function instalar() {
  const abrir = document.getElementById('app-float');
  const modal = document.getElementById('app-modal');
  if (!abrir || !modal) return;

  let pedidoNativo = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    pedidoNativo = e;
  });

  const fechar = () => { modal.hidden = true; };

  abrir.addEventListener('click', () => {
    if (pedidoNativo) {
      pedidoNativo.prompt();
      pedidoNativo = null;
      return;
    }
    modal.hidden = false;
  });

  modal.addEventListener('click', e => {
    if (e.target === modal || e.target.dataset.fechar !== undefined) fechar();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') fechar();
  });

  modal.querySelectorAll('.app-choice button').forEach(b => {
    b.addEventListener('click', () => {
      modal.querySelectorAll('.app-steps').forEach(s => s.classList.remove('show'));
      const passos = document.getElementById('passos-' + b.dataset.os);
      if (passos) passos.classList.add('show');
    });
  });
})();
