/* ============================================================
   TECNOVA Digital — o que medir
   ------------------------------------------------------------
   A medição própria funciona sempre, sem mexer aqui em nada.
   Vê-se na aba VISITAS do painel administrativo.

   OS DOIS CAMPOS ABAIXO SÃO OPCIONAIS. Enquanto estiverem
   vazios, não se carrega nada do Google nem do Meta: o site
   fica mais rápido e não precisa de aviso de cookies.

   ATENÇÃO: no dia em que preencher um destes, o site passa a
   pôr cookies de terceiros no computador dos visitantes. Na
   Europa isso obriga a um aviso de cookies com escolha antes de
   os carregar. Diga-me e eu trato disso.

   ONDE ARRANJAR OS CÓDIGOS
   ------------------------
   Google Analytics: analytics.google.com > criar propriedade >
     Fluxos de dados > Web. O código começa por G-.
   Pixel do Meta: business.facebook.com > Gestor de eventos >
     Origens de dados. É um número comprido.
   ============================================================ */
window.TECNOVA_MEDIR = {
  ativo: true,

  googleAnalytics: "",   // ex: "G-XXXXXXXXXX"
  metaPixel: ""          // ex: "123456789012345"
};
