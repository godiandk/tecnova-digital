/**
 * Uma mesa compartilhada (banca francesa, roleta — qualquer jogo onde todo mundo
 * aposta contra o mesmo resultado, não um contra o outro) identifica cada jogador
 * pela cor da ficha, do jeito que cassino físico faz. 15 cores = 15 lugares no
 * máximo por mesa. A ordem aqui é a mesma ordem pedida no prompt de imagem de
 * `docs/prompt-fichas-jogadores.md` — troque os dois juntos se mudar.
 */
export const PLAYER_COLORS = [
  'branco',
  'vermelho',
  'azul',
  'amarelo',
  'laranja',
  'roxo',
  'rosa',
  'ciano',
  'verde-limao',
  'marrom',
  'cinza-claro',
  'vinho',
  'azul-marinho',
  'coral',
  'lilas',
] as const;

export type PlayerColor = (typeof PLAYER_COLORS)[number];

export const MAX_SEATS = PLAYER_COLORS.length;
