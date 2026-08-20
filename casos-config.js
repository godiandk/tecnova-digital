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
    ativo: true,
    nome: 'Inova Beauty',
    ramo: 'Sobrancelhas, pestanas e micropigmentação',

    // ENDEREÇO TEMPORÁRIO. É o do GitHub Pages, enquanto o domínio
    // próprio não está apontado. Quando estiver, troca-se só esta
    // linha — o endereço antigo continua a funcionar na mesma, por
    // isso não há pressa nem risco de partir o link.
    url: 'https://godiandk.github.io/godiandk/',

    imagem: 'inova-beauty.jpg',
    resumo: 'Site completo, em três idiomas, com marcação online, preçário, ' +
            'conta de cliente e painel próprio para a dona gerir tudo sem ' +
            'depender de ninguém.',

    // Confirmado no site publicado, um por um. Nada aqui é suposição.
    feitos: [
      'Marcação online: escolhe serviço, dia e hora e confirma',
      'Seis serviços com página própria e preçário sempre à vista',
      'Conta de cliente com cupão de 10% na semana do aniversário',
      'Painel próprio para a dona gerir marcações e conteúdos',
      'Abre como aplicação no telemóvel, sem lojas de aplicações',
      'Português, inglês e espanhol'
    ],

    // Deixei o prazo vazio de propósito: não sei em quantos dias foi
    // entregue e não vou pôr um número que não posso provar. Escreva
    // aqui o verdadeiro — por exemplo 'Entregue em 8 dias'.
    prazo: '',

    // Um depoimento verdadeiro vale mais do que tudo o que está acima.
    // Peça-o à dona, com autorização para o publicar, e escreva-o aqui
    // pelas palavras dela. Enquanto estiver vazio, o cartão mostra o
    // resto na mesma — não fica lá nenhum buraco.
    depoimento: '',
    quemDisse: ''
  }
];
