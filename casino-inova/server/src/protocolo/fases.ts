/**
 * A máquina de estados de uma rodada, igual pros dez jogos.
 *
 * Aqui fica SÓ O NOME das fases, porque é só isso que o app precisa saber: ele mostra
 * "não vão mais apostas" e desliga os botões. Quem decide se uma transição pode
 * acontecer é o servidor, e essa regra mora lá (server/src/modules/games/core/fases.ts)
 * de propósito — regra de fase no cliente seria regra que o cliente pode contornar.
 *
 * O cliente mostra a contagem regressiva a partir de `terminaEm`, mas o relógio dele
 * chegar a zero não fecha rodada nenhuma. Atrasar o relógio do celular não ajuda.
 */
export type FaseDaRodada =
  /** Mesa aberta, esperando gente suficiente pra começar. */
  | 'ESPERANDO_JOGADORES'
  /** Rodada criada, ainda não aceitando aposta. */
  | 'RODADA_ABERTA'
  /** Aceitando apostas. */
  | 'APOSTAS_ABERTAS'
  /** "Não vão mais apostas": o que chegar agora é recusado sem mexer no saldo. */
  | 'APOSTAS_FECHADAS'
  /** Sorteio/distribuição: dados rolando, roda girando, cartas saindo. */
  | 'SORTEIO'
  /** Jogos com decisão do jogador (blackjack, truco, dominó, poker). */
  | 'ACOES_DOS_JOGADORES'
  /** Comparando resultados e decidindo quem ganhou. */
  | 'APURACAO'
  /** Creditando prêmios. */
  | 'PAGAMENTO'
  /** Rodada encerrada; a próxima pode começar. */
  | 'RODADA_FECHADA';
