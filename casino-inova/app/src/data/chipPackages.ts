/**
 * Os pacotes de ficha da loja, como a tela mostra.
 *
 * O preço e o rótulo vivem aqui porque quem cobra é a App Store / Play Store — o
 * servidor só sabe quantas fichas cada pacote entrega (ver store.service.ts), e os
 * `id` daqui precisam bater com os de lá.
 *
 * O jogador mockado que morava neste arquivo não existe mais: agora vem do servidor,
 * via `usePlayer()`.
 */
export const chipPackages = [
  { id: 'bronze', chips: 5000, priceLabel: 'R$ 9,90', bonusLabel: undefined },
  { id: 'prata', chips: 15000, priceLabel: 'R$ 24,90', bonusLabel: '+10% bônus' },
  { id: 'ouro', chips: 40000, priceLabel: 'R$ 59,90', bonusLabel: '+25% bônus' },
  { id: 'diamante', chips: 120000, priceLabel: 'R$ 149,90', bonusLabel: '+50% bônus' },
] as const;
