/**
 * Como cada jogo se abre no lobby.
 *
 * Alguns jogos são diretos: clicou, abriu (slots, roleta, stock market). Outros têm
 * mais de um jeito de jogar e precisam de uma tela no meio pra escolher — o truco, por
 * exemplo, tem variante (paulista ou mineiro) e modo (1x1 e 2x2).
 *
 * Este arquivo é a fonte única dessa estrutura: o lobby lê daqui pra decidir se manda
 * direto pro jogo ou pra tela de seleção, e a tela de seleção lê daqui pra montar as
 * opções. Acrescentar um modo novo é mexer só neste arquivo.
 */

export type ModeKind = 'direto' | 'escolher';

export interface GameModeOption {
  id: string;
  label: string;
  /** Frase curta explicando a opção — aparece embaixo do nome na tela de escolha. */
  hint: string;
  /** Pra onde vai quando escolhido. */
  route: string;
  /** Parâmetros que a tela de destino recebe (variante, modo). */
  params?: Record<string, string | number>;
  /** Modo ainda não construído — aparece marcado como "em breve" e não abre. */
  comingSoon?: boolean;
}

export interface GameModeGroup {
  /** Título do grupo na tela de escolha (ex: "Variante", "Modo"). */
  title: string;
  options: GameModeOption[];
}

export interface GameModeConfig {
  kind: ModeKind;
  /** Só em `direto`: a rota que abre na hora. */
  route?: string;
  /** Só em `escolher`: os grupos de opção, na ordem em que aparecem. */
  groups?: GameModeGroup[];
}

/**
 * Truco: a escolha é em duas etapas — primeiro a variante, depois o modo. As duas
 * viram parâmetro da mesa online. O 1x1 aponta pro modo contra bot, que é o que
 * existe hoje jogável sozinho.
 */
const TRUCO: GameModeConfig = {
  kind: 'escolher',
  groups: [
    {
      title: 'Variante',
      options: [
        {
          id: 'paulista',
          label: 'Paulista',
          hint: 'A manilha muda a cada mão, definida pela vira. Mão começa valendo 1.',
          route: 'TrucoMesa',
          params: { variant: 'paulista' },
        },
        {
          id: 'mineiro',
          label: 'Mineiro',
          hint: 'Manilhas fixas: 4♣ 7♥ A♠ 7♦. Sem vira. Mão começa valendo 2.',
          route: 'TrucoMesa',
          params: { variant: 'mineiro' },
        },
      ],
    },
    {
      title: 'Modo',
      options: [
        {
          id: '1x1',
          label: '1 x 1',
          hint: 'Duelo direto. Hoje disponível contra o computador.',
          route: 'Truco',
        },
        {
          id: '2x2',
          label: '2 x 2',
          hint: 'Em dupla, parceiros de frente. Com chat e sinais pro parceiro.',
          route: 'TrucoMesa',
        },
      ],
    },
  ],
};

const DOMINO: GameModeConfig = {
  kind: 'escolher',
  groups: [
    {
      title: 'Modo',
      options: [
        {
          id: '1x1',
          label: '1 x 1',
          hint: 'Contra o computador, 7 peças pra cada.',
          route: 'Domino',
        },
        {
          id: '2x2',
          label: '2 x 2',
          hint: 'Dominó de dupla, 4 jogadores. Vence quem chegar a 6 pontos.',
          route: 'DominoMesa',
        },
      ],
    },
  ],
};

const BANCA_FRANCESA: GameModeConfig = {
  kind: 'escolher',
  groups: [
    {
      title: 'Modo',
      options: [
        {
          id: 'sozinho',
          label: 'Sozinho',
          hint: 'Você contra a casa, no seu ritmo.',
          route: 'BancaFrancesa',
        },
        {
          id: 'mesa',
          label: 'Mesa online',
          hint: 'Até 15 pessoas na mesma mesa, cada uma com sua cor de ficha.',
          route: 'BancaFrancesaMesa',
        },
      ],
    },
  ],
};

/**
 * Jogos sem variante abrem direto — sem tela no meio. Colocar uma tela de escolha com
 * uma opção só seria só um clique a mais pra nada.
 */
export const GAME_MODES: Record<string, GameModeConfig> = {
  slots: { kind: 'direto', route: 'Slots' },
  roleta: { kind: 'direto', route: 'Roulette' },
  blackjack: { kind: 'direto', route: 'Blackjack' },
  bacara: { kind: 'direto', route: 'Baccarat' },
  'bac-bo': { kind: 'direto', route: 'BacBo' },
  'stock-market': { kind: 'direto', route: 'StockMarket' },
  poker: { kind: 'direto', route: 'Poker' },
  'banca-francesa': BANCA_FRANCESA,
  truco: TRUCO,
  domino: DOMINO,
};

export function getGameMode(gameId: string): GameModeConfig | undefined {
  return GAME_MODES[gameId];
}
