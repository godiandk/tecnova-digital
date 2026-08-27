export interface GameTutorial {
  gameId: string;
  /** Uma frase simples: o que é o jogo, sem nenhum termo técnico. */
  whatIsIt: string;
  /** Uma frase simples: como se vence. */
  goal: string;
  /** Passo a passo numerado, cada item deve fazer sentido sozinho. */
  steps: string[];
  /** Dicas curtas — o que costuma confundir quem está começando. */
  tips: string[];
}

/**
 * Conteúdo escrito para quem nunca jogou nenhum desses jogos na vida — sem gíria de
 * cassino, sem pressupor que a pessoa já sabe o que é "banca", "naipe" ou "blefe".
 * Aparece no botão de ajuda de cada mesa (ver GameTableScreen) e, na primeira visita,
 * abre sozinho.
 */
export const tutorials: Record<string, GameTutorial> = {
  slots: {
    gameId: 'slots',
    whatIsIt: 'Você aposta um valor, aperta um botão e três ou mais rolos giram sozinhos.',
    goal: 'Quando os rolos param, se os desenhos formarem uma combinação premiada numa das linhas, você ganha.',
    steps: [
      'Escolha quanto quer apostar usando os botões de + e -.',
      'Aperte o botão de girar (o círculo grande).',
      'Espere os rolos pararem de girar sozinhos.',
      'O jogo mostra automaticamente se formou uma combinação premiada e quanto você ganhou.',
    ],
    tips: [
      'Não existe estratégia para caça-níqueis — cada giro é sorte pura e independente do giro anterior.',
      'Comece apostando o valor mínimo até entender como os prêmios aparecem na tela.',
    ],
  },
  roleta: {
    gameId: 'roleta',
    whatIsIt: 'Uma bolinha é lançada numa roda que gira, com números de 0 a 36 pintados de vermelho, preto ou verde.',
    goal: 'Você aposta em qual número (ou grupo de números) a bolinha vai parar.',
    steps: [
      'Escolha suas fichas e toque no número ou grupo em que quer apostar (por exemplo: um número exato, "vermelho", ou "par").',
      'Quando todos apostarem, a roda gira e a bolinha é lançada.',
      'Espere a bolinha parar numa casa.',
      'Se você apostou onde a bolinha parou, você ganha — o jogo calcula o prêmio sozinho.',
    ],
    tips: [
      'Apostar num número exato paga muito mais, mas acerta bem menos vezes.',
      'Apostar em "vermelho/preto" ou "par/ímpar" paga menos, mas acerta com mais frequência.',
      'Dá pra apostar em vários lugares ao mesmo tempo na mesma rodada.',
    ],
  },
  blackjack: {
    gameId: 'blackjack',
    whatIsIt: 'Um jogo de cartas onde você joga sozinho contra a casa — não tem outros jogadores na sua frente.',
    goal: 'Ter na mão um total de pontos mais perto de 21 do que a casa, sem ultrapassar 21.',
    steps: [
      'Você recebe 2 cartas viradas para cima; a casa também recebe 2 cartas (uma delas fica escondida).',
      'Você decide: "pedir carta" (recebe mais uma) ou "parar" (fica com o total que já tem).',
      'Se o seu total passar de 21, você perde a rodada na hora, sem precisar esperar a casa jogar.',
      'Quando você decide parar, a casa revela a carta escondida e é obrigada a seguir uma regra fixa (por exemplo, sempre pedir carta até chegar em 17).',
      'Quem ficar mais perto de 21 sem passar, ganha.',
    ],
    tips: [
      'Cartas numéricas valem o próprio número, J/Q/K valem 10, e o Ás vale 1 ou 11 — o que for melhor pra você naquele momento.',
      'Com 12 pontos ou mais, pedir carta já é arriscado, porque muitas cartas podem fazer você passar de 21.',
    ],
  },
  bacara: {
    gameId: 'bacara',
    whatIsIt: 'Duas mãos de cartas são compradas automaticamente pelo jogo: uma chamada "Jogador" e outra chamada "Banca".',
    goal: 'Adivinhar qual das duas mãos vai somar mais perto de 9 pontos — ou se as duas vão empatar.',
    steps: [
      'Antes de qualquer carta ser distribuída, você escolhe onde apostar: "Jogador", "Banca" ou "Empate".',
      'O jogo distribui as cartas das duas mãos sozinho, sem você precisar decidir nada.',
      'A mão que somar mais perto de 9 pontos vence a rodada.',
      'Se você apostou no lado que venceu, você ganha o prêmio correspondente.',
    ],
    tips: [
      'Você não toma nenhuma decisão durante a rodada — a única escolha é onde apostar antes de começar.',
      'Estatisticamente, apostar em "Banca" tem a maior chance de acerto entre as três opções.',
    ],
  },
  'banca-francesa': {
    gameId: 'banca-francesa',
    whatIsIt: 'O tradicional jogo de dados português "Grande e Pequena". Três dados são lançados e você aposta na SOMA dos três, não num número sozinho.',
    goal: 'Acertar em qual faixa a soma dos 3 dados vai cair: Pequeno, Grande ou Ases.',
    steps: [
      'Escolha uma ou mais apostas: Pequeno (soma 5, 6 ou 7), Grande (soma 14, 15 ou 16), Ases (soma 3 — os três dados caem no 1) ou Linha (meio a meio entre Grande e Pequeno).',
      'Quando todo mundo terminar de apostar, os 3 dados são lançados.',
      'Se a soma não cair em nenhuma dessas faixas (por exemplo 9 ou 12), o resultado é nulo: os dados são lançados de novo automaticamente, e suas apostas continuam valendo.',
      'Quem acertou a faixa recebe o prêmio na hora.',
    ],
    tips: [
      'Ases é a aposta mais arriscada (só 1 jeito em 216 de sair), mas paga 61 pra 1 — de longe o maior prêmio da mesa.',
      'Pequeno e Grande pagam 1 pra 1 (dobra sua ficha) e saem quase metade das vezes cada — são as apostas mais seguras.',
      'A Linha divide sua ficha meio a meio entre Grande e Pequeno: se sair qualquer um dos dois você recebe sua ficha de volta inteira, só perde tudo se sair Ases.',
      'Dá pra apostar em mais de um tipo ao mesmo tempo na mesma rodada.',
    ],
  },
  truco: {
    gameId: 'truco',
    whatIsIt: 'Um jogo de cartas brasileiro, jogado em dupla ou individual, que mistura cartas fortes com blefe.',
    goal: 'Vencer rodadas jogando a carta mais forte, ou fazer o adversário desistir blefando.',
    steps: [
      'Cada jogador recebe 3 cartas na mão.',
      'Na sua vez, você escolhe uma carta e joga na mesa.',
      'Quem jogar a carta mais forte naquela rodada, vence a rodada.',
      'Vence o jogo quem ganhar 2 das 3 rodadas — ou quem fizer o adversário desistir ao pedir "truco" para aumentar a aposta.',
    ],
    tips: [
      'No truco, as cartas mais fortes não seguem a ordem que você imagina — por exemplo, o 4 de paus é uma das cartas mais fortes do baralho, mais forte que um Rei.',
      'O jogo sempre mostra a força de cada carta na tela, então você não precisa decorar nada.',
    ],
  },
  domino: {
    gameId: 'domino',
    whatIsIt: 'Um jogo de peças retangulares com pontinhos desenhados, divididas ao meio.',
    goal: 'Ser o primeiro jogador a ficar sem nenhuma peça na mão.',
    steps: [
      'Cada jogador recebe um conjunto de peças no início.',
      'Na sua vez, você encaixa uma peça sua numa das pontas da mesa, desde que o número bata com o número que já está ali.',
      'Se você não tiver nenhuma peça que encaixe, sua vez passa direto para o próximo jogador.',
      'Quem ficar sem peças primeiro, vence a rodada.',
    ],
    tips: [
      'Preste atenção em quais números já apareceram bastante na mesa — ajuda a imaginar o que os outros jogadores ainda têm na mão.',
      'Se ninguém mais conseguir jogar, vence quem tiver a menor soma de pontos nas peças que sobraram.',
    ],
  },
  poker: {
    gameId: 'poker',
    whatIsIt: 'O jogo de cartas mais famoso do mundo. Cada jogador forma a melhor combinação possível de 5 cartas.',
    goal: 'Ter a melhor combinação de 5 cartas na mesa no final da rodada — ou fazer todo mundo desistir antes disso.',
    steps: [
      'Você recebe 2 cartas que só você pode ver.',
      'Cinco cartas vão sendo reveladas aos poucos no centro da mesa, e todos os jogadores usam essas mesmas 5 cartas.',
      'A cada nova carta revelada, você decide: apostar fichas, pagar a aposta de outro jogador, ou desistir da rodada (o que faz você perder só o que já apostou até ali, sem arriscar mais).',
      'No final, quem tiver a melhor combinação juntando suas 2 cartas com as 5 da mesa, ganha todas as fichas apostadas na rodada.',
    ],
    tips: [
      'Você não é obrigado a usar as duas cartas da sua mão — pode usar só uma, ou nenhuma, se as 5 cartas da mesa já formarem uma combinação melhor sozinhas.',
      'Desistir de uma rodada ruim é normal e faz parte do jogo — não precisa jogar até o final toda vez.',
    ],
  },
};

export function getTutorialByGameId(gameId: string): GameTutorial | undefined {
  return tutorials[gameId];
}
