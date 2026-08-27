export type GameFormat = 'vs-casa' | 'mesa-multiplayer';

export interface Game {
  id: string;
  name: string;
  format: GameFormat;
  /** Fase do roadmap em que o jogo entra em produção — ver plano de produto. */
  phase: 1 | 2 | 3 | 4;
  minLevel: number;
  /** Nome do arquivo de mesa em assets/images/mesas/, sem extensão. */
  tableImageKey: string;
  accent: 'felt' | 'ruby' | 'sapphire' | 'gold';
}

/**
 * Catálogo dos 10 jogos do Casino Inova.
 *
 * Os dez estão prontos e liberados: `minLevel: 1` em todos. O campo continua existindo
 * porque a regra do plano de produto continua valendo se um dia for usada — nível
 * libera mesa de aposta mais alta, e NUNCA muda a probabilidade de vitória. Só que
 * travar jogo pronto atrás de nível é decisão de retenção, não de produto, e hoje o
 * lobby mostra tudo aberto.
 *
 * `phase` guarda a ordem em que os jogos foram construídos. Todos chegaram, então todos
 * são fase 1 — o lobby não tem mais seção de "chegando em breve" porque não há nada
 * chegando: já chegou.
 */
export const games: Game[] = [
  { id: 'slots', name: 'Caça-Níqueis', format: 'vs-casa', phase: 1, minLevel: 1, tableImageKey: 'caca-niquel-gabinete-fortuna', accent: 'gold' },
  { id: 'roleta', name: 'Roleta', format: 'vs-casa', phase: 1, minLevel: 1, tableImageKey: 'mesa-roleta', accent: 'ruby' },
  { id: 'blackjack', name: 'Blackjack', format: 'vs-casa', phase: 1, minLevel: 1, tableImageKey: 'mesa-blackjack', accent: 'felt' },
  { id: 'bacara', name: 'Bacará', format: 'vs-casa', phase: 1, minLevel: 1, tableImageKey: 'mesa-bacara', accent: 'felt' },
  { id: 'bac-bo', name: 'Bac Bo', format: 'vs-casa', phase: 1, minLevel: 1, tableImageKey: 'mesa-bac-bo', accent: 'ruby' },
  { id: 'stock-market', name: 'Stock Market', format: 'vs-casa', phase: 1, minLevel: 1, tableImageKey: 'mesa-stock-market', accent: 'gold' },
  { id: 'banca-francesa', name: 'Banca Francesa', format: 'mesa-multiplayer', phase: 1, minLevel: 1, tableImageKey: 'mesa-banca-francesa', accent: 'gold' },
  { id: 'truco', name: 'Truco', format: 'mesa-multiplayer', phase: 1, minLevel: 1, tableImageKey: 'mesa-truco', accent: 'sapphire' },
  { id: 'domino', name: 'Dominó', format: 'mesa-multiplayer', phase: 1, minLevel: 1, tableImageKey: 'mesa-domino', accent: 'sapphire' },
  { id: 'poker', name: 'Poker', format: 'mesa-multiplayer', phase: 1, minLevel: 1, tableImageKey: 'mesa-poker', accent: 'felt' },
];

export function getGameById(id: string): Game | undefined {
  return games.find((game) => game.id === id);
}
