import type { FaseDaRodada } from './fases';

/**
 * O contrato entre o app e o servidor, num arquivo só.
 *
 * Ele é SÓ TIPO, de propósito: nada aqui existe em tempo de execução. Assim os dois
 * lados podem importar com `import type` e o empacotador do app nunca precisa nem
 * resolver o arquivo — o TypeScript confere, o bundle não carrega nada.
 *
 * O que isso compra: hoje o gateway declara o corpo de cada evento inline
 * (`@MessageBody() body: { tableId: string }`) e a tela monta o objeto na mão. As duas
 * declarações são independentes, então renomear um campo de um lado compila dos dois e
 * quebra em produção. Com o contrato aqui, quebra na hora de compilar.
 */

/** Tudo que o cliente pode PEDIR. O cliente manda intenção; quem decide é o servidor. */
export type AcaoDoCliente =
  | { tipo: 'ENTRAR_NA_MESA'; mesaId: string; acaoId: string }
  | { tipo: 'SAIR_DA_MESA'; mesaId: string; acaoId: string }
  | { tipo: 'APOSTAR'; mesaId: string; rodadaId: string; mercado: string; valor: number; acaoId: string }
  | { tipo: 'LIMPAR_APOSTAS'; mesaId: string; rodadaId: string; acaoId: string }
  | { tipo: 'BLACKJACK_PEDIR'; mesaId: string; maoId: string; acaoId: string }
  | { tipo: 'BLACKJACK_PARAR'; mesaId: string; maoId: string; acaoId: string }
  | { tipo: 'BLACKJACK_DOBRAR'; mesaId: string; maoId: string; acaoId: string }
  | { tipo: 'BLACKJACK_DIVIDIR'; mesaId: string; maoId: string; acaoId: string }
  | { tipo: 'TRUCO_PEDIR'; mesaId: string; valor: 3 | 6 | 9 | 12; acaoId: string }
  | { tipo: 'TRUCO_RESPONDER'; mesaId: string; resposta: 'quero' | 'nao-quero' | 'aumentar'; acaoId: string }
  | { tipo: 'DOMINO_JOGAR'; mesaId: string; peca: { a: number; b: number }; ponta: 'esquerda' | 'direita'; acaoId: string }
  | { tipo: 'DOMINO_PASSAR'; mesaId: string; acaoId: string }
  | { tipo: 'POKER_AGIR'; mesaId: string; acao: 'desistir' | 'passar' | 'pagar' | 'aumentar'; valor?: number; acaoId: string }
  /** Depois de cair, o cliente volta com isto pra recuperar assento, mão e rodada. */
  | { tipo: 'RECONECTAR'; mesaId: string; ultimoEventoVisto: number; acaoId: string };

/** Tudo que o servidor ANUNCIA. */
export type EventoDoServidor =
  /** Estado público da mesa, inteiro. Mandado ao entrar e ao reconectar. */
  | { tipo: 'ESTADO'; mesaId: string; versao: number; estado: unknown }
  /** Só pro dono: cartas na mão, que nunca entram no estado público. */
  | { tipo: 'ESTADO_PRIVADO'; mesaId: string; versao: number; estado: unknown }
  | { tipo: 'FASE'; mesaId: string; rodadaId: string; fase: FaseDaRodada; terminaEm: number | null; seq: number }
  | { tipo: 'ACAO_ACEITA'; acaoId: string; seq: number }
  | { tipo: 'ACAO_RECUSADA'; acaoId: string; codigo: CodigoDeRecusa; mensagem: string }
  /** Algo que aconteceu na mesa e todo mundo pode ver. */
  | { tipo: 'EVENTO_PUBLICO'; mesaId: string; seq: number; evento: unknown }
  | { tipo: 'SALDO'; saldo: number; lancamentoId: string };

/**
 * Por que a ação foi recusada. Código, e não só texto, pra a tela poder reagir
 * diferente — "fora de fase" some sozinho na próxima rodada, "saldo insuficiente"
 * merece abrir o caixa.
 */
export type CodigoDeRecusa =
  | 'NAO_IDENTIFICADO'
  | 'FORA_DE_FASE'
  | 'NAO_E_SUA_VEZ'
  | 'SEM_ASSENTO'
  | 'SALDO_INSUFICIENTE'
  | 'VALOR_INVALIDO'
  | 'MESA_CHEIA'
  | 'MESA_NAO_ENCONTRADA'
  | 'JOGADA_INVALIDA'
  | 'RAPIDO_DEMAIS'
  | 'ERRO_INTERNO';

/** O nome de cada ação, derivado do próprio tipo — não dá pra escrever errado. */
export type NomeDaAcao = AcaoDoCliente['tipo'];
export type NomeDoEvento = EventoDoServidor['tipo'];

/** A ação de um tipo específico, pro handler receber o corpo certo. */
export type Acao<T extends NomeDaAcao> = Extract<AcaoDoCliente, { tipo: T }>;
export type Evento<T extends NomeDoEvento> = Extract<EventoDoServidor, { tipo: T }>;
