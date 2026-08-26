/**
 * Placeholder até existir o backend da Fase 0 (conta + carteira). Nenhuma tela deve
 * importar isto além das telas de UI deste esqueleto — quando a autenticação e a
 * carteira real existirem, isto vira um hook (`usePlayer()`) alimentado pela API.
 */
export interface MockPlayer {
  name: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  chipBalance: number;
  vipTier: 'bronze' | 'prata' | 'ouro' | 'diamante';
  friends: { id: string; name: string; online: boolean }[];
}

export const mockPlayer: MockPlayer = {
  name: 'Convidado',
  level: 4,
  xp: 320,
  xpToNextLevel: 500,
  chipBalance: 12500,
  vipTier: 'prata',
  friends: [
    { id: 'f1', name: 'Marina', online: true },
    { id: 'f2', name: 'Diego', online: false },
    { id: 'f3', name: 'Paula', online: true },
  ],
};

export const chipPackages = [
  { id: 'bronze', chips: 5000, priceLabel: 'R$ 9,90', bonusLabel: undefined },
  { id: 'prata', chips: 15000, priceLabel: 'R$ 24,90', bonusLabel: '+10% bônus' },
  { id: 'ouro', chips: 40000, priceLabel: 'R$ 59,90', bonusLabel: '+25% bônus' },
  { id: 'diamante', chips: 120000, priceLabel: 'R$ 149,90', bonusLabel: '+50% bônus' },
] as const;
