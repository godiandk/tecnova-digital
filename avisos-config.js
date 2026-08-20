/* ============================================================
   TECNOVA Digital — avisos de pedido novo
   ------------------------------------------------------------
   COM O PAINEL ABERTO já funciona sem mexer aqui em nada: toca
   um som, salta um aviso e o número aparece no separador.

   COM TUDO FECHADO é preciso alguém a enviar o email — e um site
   como este, feito só de ficheiros, não envia emails sozinho.
   Não há maneira de contornar isso sem um serviço pelo meio.

   A FORMA MAIS BARATA (grátis até 200 emails por mês)
   ---------------------------------------------------
   1. Criar conta em https://www.emailjs.com
   2. Adicionar o serviço de email (pode ser o próprio Zoho).
   3. Criar um template com estas variáveis:
        {{nome}} {{negocio}} {{email}} {{telefone}}
        {{referencia}} {{total}} {{sinal}}
   4. Copiar os três códigos para aqui em baixo.

   Enquanto estiverem vazios não se carrega nada e não se envia
   nada — o painel funciona à mesma.

   AVISO HONESTO: com isto, o email é enviado pelo browser de quem
   está a ver o painel, não por um servidor. Ou seja, o email só
   sai se o painel estiver aberto nalgum lado. Para aviso a sério
   com tudo fechado é preciso o plano pago do Firebase (Blaze) e
   uma Cloud Function — aí eu trato disso.
   ============================================================ */
window.TECNOVA_AVISOS = {
  emailjsUtilizador: "",   // Public Key
  emailjsServico:    "",   // Service ID
  emailjsTemplate:   "",   // Template ID

  // Para onde vai o aviso.
  para: "wesley@tecnovadigital.pt"
};
