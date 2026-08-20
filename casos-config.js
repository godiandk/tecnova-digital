/* ============================================================
   TECNOVA Digital — projetos reais
   ------------------------------------------------------------
   Sete modelos bonitos de negócios que não existem provam que se
   sabe desenhar. Um único cliente a sério, com o site no ar e o
   nome dele, prova que se sabe entregar — e é isso que faz alguém
   pagar. É o que falta ao site.

   COMO LIGAR UM CASO, QUANDO O SITE ESTIVER NO AR
   1. Ponha `ativo: true`.
   2. Escreva o endereço em `url` (com https://).
   3. Ponha uma imagem em `img/casos/` e escreva o nome do
      ficheiro em `imagem`.
   Mais nada. Enquanto `ativo` for `false`, a secção inteira não
   aparece — nada de "em breve" nem de espaços vazios à espera.

   REGRA QUE NÃO SE QUEBRA
   Só entra aqui o que for verdade e estiver no ar. Um depoimento
   inventado descobre-se num telefonema e custa mais do que
   qualquer venda que trouxesse.
   ============================================================ */
window.TECNOVA_CASOS = [
  {
    ativo: false,                    // ← mude para true quando o site estiver no ar
    nome: 'Inova Beauty',
    ramo: 'Clínica de estética',
    url: '',                         // ← https://…
    imagem: '',                      // ← ficheiro em img/casos/
    resumo: 'Site completo com marcações pelo próprio site, preçário sempre ' +
            'atualizado e cartão de fidelidade digital.',
    // Só factos verificáveis. Deixe fora o que não puder provar.
    feitos: [
      'Marcações pelo próprio site',
      'Preçário que a dona atualiza sozinha',
      'Cartão de fidelidade digital',
      'Aplicação instalável no telemóvel'
    ],
    prazo: '',                       // ex.: 'Entregue em 6 dias'
    // Depoimento verdadeiro, escrito pela pessoa, com autorização dela.
    // Se não houver, deixe vazio: a secção mostra o resto na mesma.
    depoimento: '',
    quemDisse: ''
  }
];
