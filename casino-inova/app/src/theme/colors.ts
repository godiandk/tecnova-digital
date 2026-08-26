/**
 * Paleta do Casino Inova — cassino de luxo contemporâneo (preto/esmeralda/dourado),
 * a mesma paleta descrita no briefing de imagens em docs/briefing-imagens-casino-inova.md.
 * O app é intencionalmente de tema único (sempre escuro) — não segue o tema claro/escuro
 * do sistema, igual a Jackpot World e Blackjackist.
 */
export const colors = {
  background: '#0B0F0D',
  backgroundElevated: '#121A15',
  backgroundCard: '#16211B',

  felt: '#0F5132',
  feltBright: '#177A4C',
  feltLine: '#2E6B4C',

  gold: '#E5B567',
  goldBright: '#FFD98A',
  goldDeep: '#8A6420',

  ruby: '#E63950',
  sapphire: '#3D7DE0',

  textPrimary: '#F5F1E6',
  textSecondary: '#B9C2BB',
  textFaint: '#6E786F',

  success: '#3FBF7F',
  danger: '#E1523D',

  overlay: 'rgba(11,15,13,0.72)',
} as const;

export type ColorToken = keyof typeof colors;
