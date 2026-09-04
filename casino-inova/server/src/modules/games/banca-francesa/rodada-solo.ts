import { BancaFrancesaBet } from './banca-francesa.engine';
import { LancamentoNoPlacar } from './placar-da-banca';

/**
 * A RODADA DA MESA DE UM JOGADOR SÓ, como máquina de estados explícita.
 *
 * O QUE MUDOU, E POR QUÊ. Antes a rodada inteira acontecia numa chamada: o servidor
 * debitava, relançava os dados sozinho até sair um resultado decisivo e pagava. O
 * jogador tocava uma vez e recebia o fim. Isso tem três problemas, e o primeiro é de
 * regra:
 *
 *   1. O RELANÇAMENTO NÃO É DO SERVIDOR. Numa mesa de verdade, o lançamento nulo PARA a
 *      rodada: os dados ficam na mesa, as apostas ficam de pé, e quem decide se joga de
 *      novo — mantendo, aumentando, diminuindo, mudando de casa ou retirando — é quem
 *      apostou. Relançar automaticamente tira do jogador a decisão que mais importa
 *      nesse jogo.
 *
 *   2. O DÉBITO ACONTECIA CEDO DEMAIS. A ficha saía do saldo antes de existir resultado.
 *      Num lançamento nulo, nada foi decidido — então nada pode ser cobrado nem pago.
 *
 *   3. A rodada não tinha estado, então não havia o que informar numa reconexão. Quem
 *      recarregasse a página no meio de uma sequência de nulos perdia a mesa.
 *
 * A MÁQUINA. Os estados e as únicas transições possíveis:
 *
 *     APOSTAS_ABERTAS ──confirmar──▶ APOSTAS_CONFIRMADAS ──lançar──▶ (decide?)
 *            ▲                              │                          │
 *            │                              │                    não   │   sim
 *            └──────editar/retirar──────────┘◀───────nulo─────────┘    ▼
 *                                                                  LIQUIDADA
 *                                                                      │
 *                                                          nova rodada │
 *                                                                      ▼
 *                                                            APOSTAS_ABERTAS
 *
 * O DINHEIRO SÓ SE MEXE NA SETA "sim". Confirmar não custa, retirar não custa, e um
 * lançamento nulo não custa. É a mesma promessa da mesa compartilhada, pelo mesmo
 * motivo: enquanto o dado não decidiu, ninguém apostou de verdade.
 */
export type EstadoDaRodada = 'APOSTAS_ABERTAS' | 'APOSTAS_CONFIRMADAS' | 'LIQUIDADA';

/** As transições que existem. Qualquer outra é recusada — pelo servidor, não pela tela. */
export const TRANSICOES: Record<EstadoDaRodada, readonly EstadoDaRodada[]> = {
  APOSTAS_ABERTAS: ['APOSTAS_CONFIRMADAS'],
  /*
   * De CONFIRMADAS dá pra ir pros dois lados: voltar pra ABERTAS (o jogador mexeu na
   * aposta, ou o lançamento saiu nulo) ou ir pra LIQUIDADA (o lançamento decidiu).
   */
  APOSTAS_CONFIRMADAS: ['APOSTAS_ABERTAS', 'LIQUIDADA'],
  LIQUIDADA: ['APOSTAS_ABERTAS'],
};

export function podeIrPara(atual: EstadoDaRodada, proximo: EstadoDaRodada): boolean {
  return TRANSICOES[atual].includes(proximo);
}

/** Só neste estado o jogador pode lançar. É a pergunta que o serviço faz antes de sortear. */
export function podeLancar(estado: EstadoDaRodada): boolean {
  return estado === 'APOSTAS_CONFIRMADAS';
}

/** Só nestes estados a aposta pode ser mexida. */
export function podeMexerNaAposta(estado: EstadoDaRodada): boolean {
  return estado === 'APOSTAS_ABERTAS' || estado === 'APOSTAS_CONFIRMADAS';
}

export interface RodadaSolo {
  /** Identificador da rodada. Muda quando uma rodada nova começa, não a cada lançamento. */
  rodadaId: string;
  estado: EstadoDaRodada;
  /** As apostas de pé. Vazio em APOSTAS_ABERTAS sem nada encostado. */
  apostas: BancaFrancesaBet[];
  /**
   * Os lançamentos NULOS desta rodada, na ordem. Ficam à vista porque são o motivo de a
   * rodada ainda estar aberta — a tela mostra os dados que não decidiram.
   */
  nulos: LancamentoNoPlacar[];
  /**
   * O último lançamento saiu nulo e a mesa está esperando o jogador decidir.
   *
   * O ESTADO NÃO MUDA quando dá nulo — as fichas continuam confirmadas, na mesa, do
   * jeito que a pessoa deixou. Exigir reconfirmar seria transformar "manter a aposta"
   * numa tarefa, quando manter é justamente a opção que não deveria dar trabalho.
   *
   * O que este campo faz é a tela saber que precisa dizer LANÇAMENTO NULO e trocar o
   * botão de "Lançar" para "Jogar novamente" — e que não deve começar sozinha. Quem
   * relança é o jogador, sempre.
   */
  esperandoDepoisDoNulo: boolean;
  /** Quando a rodada começou. Serve pro cliente saber se o que ele tem é velho. */
  abertaEm: string;
}

/** Uma rodada nova, vazia e aberta. */
export function rodadaNova(rodadaId: string): RodadaSolo {
  return {
    rodadaId,
    estado: 'APOSTAS_ABERTAS',
    apostas: [],
    nulos: [],
    esperandoDepoisDoNulo: false,
    abertaEm: new Date().toISOString(),
  };
}
