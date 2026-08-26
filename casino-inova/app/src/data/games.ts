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
 * Catálogo dos 8 jogos do Casino Inova. `minLevel` reflete a mesma regra descrita
 * no plano de produto: nível libera acesso a mesas de aposta mais alta, nunca muda
 * a probabilidade de vitória.
 */
export const games: Game[] = [
  { id: 'slots', name: 'Caça-Níqueis', format: 'vs-casa', phase: 1, minLevel: 1, tableImageKey: 'caca-niquel-gabinete-fortuna', accent: 'gold' },
  { id: 'roleta', name: 'Roleta', format: 'vs-casa', phase: 1, minLevel: 1, tableImageKey: 'mesa-roleta', accent: 'ruby' },
  { id: 'blackjack', name: 'Blackjack', format: 'vs-casa', phase: 1, minLevel: 3, tableImageKey: 'mesa-blackjack', accent: 'felt' },
  { id: 'bacara', name: 'Bacará', format: 'vs-casa', phase: 2, minLevel: 6, tableImageKey: 'mesa-bacara', accent: 'felt' },
  { id: 'banca-francesa', name: 'Banca Francesa', format: 'mesa-multiplayer', phase: 2, minLevel: 8, tableImageKey: 'mesa-banca-francesa', accent: 'gold' },
  { id: 'truco', name: 'Truco', format: 'mesa-multiplayer', phase: 3, minLevel: 10, tableImageKey: 'mesa-truco', accent: 'sapphire' },
  { id: 'domino', name: 'Dominó', format: 'mesa-multiplayer', phase: 3, minLevel: 10, tableImageKey: 'mesa-domino', accent: 'sapphire' },
  { id: 'poker', name: 'Pôquer', format: 'mesa-multiplayer', phase: 4, minLevel: 15, tableImageKey: 'mesa-poker', accent: 'felt' },
];

export function getGameById(id: string): Game | undefined {
  return games.find((game) => game.id === id);
}
