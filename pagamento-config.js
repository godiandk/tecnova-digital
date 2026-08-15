/* ============================================================
   TECNOVA Digital — configuração dos pagamentos
   ------------------------------------------------------------
   É aqui que se mexe. A página `pagamento.html` não precisa de
   ser tocada.

   COMO PÔR O PAGAMENTO POR CARTÃO E EM PRESTAÇÕES A FUNCIONAR
   -----------------------------------------------------------
   1. Abre conta em https://dashboard.stripe.com (precisa do NIF
      com atividade aberta nas Finanças).
   2. Em Definições > Métodos de pagamento, liga: Cartões,
      MB WAY, Multibanco e Klarna.
   3. Em Pagamentos > Links de pagamento, cria um link.
      Como o valor muda de cliente para cliente, a forma mais
      simples com este volume é criar um link por orçamento,
      já com o valor do sinal, e enviá-lo pelo chat do site ou por email.
      Nesse caso deixa `linkCartao` e `linkPrestacoes` vazios e
      manda o link à mão.
   4. Se um dia quiser um link fixo (por exemplo, para o pacote
      Essencial), cola-o aqui e o botão aparece sozinho.

   ENQUANTO NÃO HOUVER STRIPE
   --------------------------
   Deixe os dois links vazios. A página mostra só MB WAY e
   transferência — que funcionam já hoje e não cobram taxa
   nenhuma. Não fica nada partido.
   ============================================================ */
window.TECNOVA_PAGAMENTO = {

  // Link do Stripe para cartão / Apple Pay / Google Pay.
  linkCartao: "",

  // Link do Stripe com o Klarna ligado (3 prestações sem juros).
  // Pode ser o mesmo link do cartão: o Klarna aparece como opção
  // na página do Stripe se estiver ativado na conta.
  linkPrestacoes: "",

  simbolos: { BRL: "R$ ", USD: "$ ", GBP: "£ ", CHF: "CHF ", CAD: "C$ " },

  // Dados para quem paga por transferência, por moeda.
  // Tem de bater certo com o que está em orcamento.js.
  dados: {
    EUR: {
      titulo: "MB WAY ou transferência",
      linhas: [
        ["MB WAY", "+351 933 113 525"],
        ["IBAN", "PT50 0007 0000 0074 9704 5622 3"],
        ["Banco", "Novo Banco"],
        ["Titular", "Wesley Vianna"]
      ],
      nota: "Indique a referência do orçamento na descrição da transferência."
    },
    BRL: {
      titulo: "Pix",
      linhas: [
        ["Chave Pix (email)", "viannakoa3@gmail.com"],
        ["Nome do titular", "Wesley Vianna"],
        ["Banco", "Bradesco"]
      ],
      nota: "Depois de pagar, envie o comprovativo por email com a referência do orçamento."
    }
  }
};
