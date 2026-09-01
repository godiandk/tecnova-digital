import type { FaseDaRodada } from '../../../protocolo';
import { podeIrPara } from './fases';

/**
 * A fase de uma mesa e quanto falta pra ela acabar.
 *
 * Duas decisões que a especificação pede, e que mudam como o cliente se comporta:
 *
 * 1. O prazo é um INSTANTE ABSOLUTO (`terminaEm`), não uma contagem regressiva mandada
 *    de segundo em segundo. Assim o app anima o relógio sozinho, sem depender de a rede
 *    entregar 20 mensagens; e se ele perder mensagem, o número continua certo.
 *
 * 2. O relógio do cliente chegar a zero NÃO fecha nada. Quem fecha é o servidor, quando
 *    `expirou()` for verdade aqui. Adiantar o relógio do celular não abre aposta fora de
 *    hora, e atrasar não estende o prazo de ninguém.
 */
export class RelogioDaSala {
  private _fase: FaseDaRodada = 'ESPERANDO_JOGADORES';
  private _terminaEm: number | null = null;
  /** Sobe a cada mudança. É como o cliente sabe que o estado que ele tem é velho. */
  private _versao = 0;

  get fase(): FaseDaRodada {
    return this._fase;
  }

  get terminaEm(): number | null {
    return this._terminaEm;
  }

  get versao(): number {
    return this._versao;
  }

  /**
   * Muda de fase, recusando pulo que a máquina de estados não permite.
   *
   * Recusar em vez de aceitar é de propósito: um jogo que tente ir de APOSTAS_ABERTAS
   * direto pra PAGAMENTO tem um bug, e o lugar de descobrir isso é aqui, não no extrato
   * de alguém.
   */
  irPara(fase: FaseDaRodada, duracaoMs?: number): void {
    if (fase !== this._fase && !podeIrPara(this._fase, fase)) {
      throw new Error(`Transição de fase inválida: ${this._fase} -> ${fase}.`);
    }
    this._fase = fase;
    this._terminaEm = duracaoMs === undefined ? null : Date.now() + duracaoMs;
    this._versao += 1;
  }

  /** A fase tinha prazo e ele passou. Fase sem prazo nunca expira sozinha. */
  expirou(agora = Date.now()): boolean {
    return this._terminaEm !== null && agora >= this._terminaEm;
  }

  /** Quanto falta, em ms. Null quando a fase não tem prazo. */
  restanteMs(agora = Date.now()): number | null {
    return this._terminaEm === null ? null : Math.max(0, this._terminaEm - agora);
  }

  /** O que vai no evento FASE — o mesmo formato pros dez jogos. */
  paraEvento() {
    return { fase: this._fase, terminaEm: this._terminaEm, versao: this._versao };
  }
}
