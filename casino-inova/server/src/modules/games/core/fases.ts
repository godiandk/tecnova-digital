import type { FaseDaRodada } from '../../../protocolo';

/**
 * As transições que uma rodada pode fazer, e quem pode fazer o quê em cada fase.
 *
 * Fica fora de src/protocolo por dois motivos: é regra (e regra que o cliente executa é
 * regra que o cliente pode contornar), e é valor em tempo de execução — o protocolo é só
 * tipo, pra o app poder importá-lo com `import type` sem o empacotador dele precisar
 * alcançar arquivo nenhum.
 *
 * Ter a máquina num lugar só, e não uma por jogo, é o que faz "não dá pra apostar
 * depois do fechamento" existir uma vez em vez de dez. Um jogo pode PULAR fases —
 * slots não tem ACOES_DOS_JOGADORES — mas nenhum inventa fase própria.
 */
export const PROXIMAS_FASES: Record<FaseDaRodada, readonly FaseDaRodada[]> = {
  ESPERANDO_JOGADORES: ['RODADA_ABERTA'],
  RODADA_ABERTA: ['APOSTAS_ABERTAS', 'ESPERANDO_JOGADORES'],
  APOSTAS_ABERTAS: ['APOSTAS_FECHADAS'],
  // Pular ACOES_DOS_JOGADORES é normal: slots, roleta e bacará não têm decisão.
  APOSTAS_FECHADAS: ['SORTEIO'],
  SORTEIO: ['ACOES_DOS_JOGADORES', 'APURACAO'],
  ACOES_DOS_JOGADORES: ['APURACAO'],
  APURACAO: ['PAGAMENTO'],
  PAGAMENTO: ['RODADA_FECHADA'],
  RODADA_FECHADA: ['RODADA_ABERTA', 'ESPERANDO_JOGADORES'],
};

/** Só nesta fase aposta entra. Todo jogo consulta isto em vez de reimplementar. */
export function aceitaAposta(fase: FaseDaRodada): boolean {
  return fase === 'APOSTAS_ABERTAS';
}

export function podeIrPara(atual: FaseDaRodada, proxima: FaseDaRodada): boolean {
  return PROXIMAS_FASES[atual].includes(proxima);
}

/** As fases em que a rodada já foi decidida — não cabe mais ação de jogador. */
export function rodadaDecidida(fase: FaseDaRodada): boolean {
  return fase === 'APURACAO' || fase === 'PAGAMENTO' || fase === 'RODADA_FECHADA';
}
