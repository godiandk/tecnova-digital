import { Injectable } from '@nestjs/common';

/**
 * A janela de reconexão: o que segura o assento de quem caiu.
 *
 * Hoje `handleDisconnect` no gateway só apaga o socket do mapa. Quem perdeu sinal no
 * meio de uma mão de truco simplesmente sumiu da mesa — e como a mão continua, some
 * junto com as fichas que já estavam apostadas.
 *
 * A regra da especificação é outra: sair NÃO elimina a mão na hora. Marca a hora da
 * queda e abre uma janela; se a pessoa voltar dentro dela, reassume o mesmo assento com
 * a mesma mão. Se estourar, o jogo aplica o fallback configurado (passar, correr,
 * auto-stand), que é decisão de cada jogo, não daqui.
 *
 * O que este serviço NÃO faz de propósito: não guarda estado de jogo. Ele só sabe quem
 * está fora, desde quando, e em que assento. O estado continua sendo do jogo.
 */
export interface AusenciaDeJogador {
  userId: string;
  mesaId: string;
  assento: number;
  caiuEm: number;
  /** Depois disto o jogo decide o que fazer com o assento. */
  expiraEm: number;
  /** O último evento que essa pessoa tinha visto, pra o retorno mandar só o que faltou. */
  ultimoEventoVisto: number;
}

/**
 * Quanto tempo o assento fica guardado. Trinta segundos cobre a troca de wi-fi pra
 * dados, o app indo pro fundo e voltando, e o elevador — sem prender a mesa dos outros
 * por muito tempo.
 */
export const JANELA_DE_RECONEXAO_MS = 30_000;

@Injectable()
export class ReconexaoService {
  private readonly ausentes = new Map<string, AusenciaDeJogador>();

  private chave(mesaId: string, userId: string) {
    return `${mesaId}:${userId}`;
  }

  /** Marca a queda. Chamado no disconnect, não no "sair da mesa" — sair é definitivo. */
  registrarQueda(mesaId: string, userId: string, assento: number, ultimoEventoVisto: number): AusenciaDeJogador {
    const agora = Date.now();
    const ausencia: AusenciaDeJogador = {
      userId,
      mesaId,
      assento,
      caiuEm: agora,
      expiraEm: agora + JANELA_DE_RECONEXAO_MS,
      ultimoEventoVisto,
    };
    this.ausentes.set(this.chave(mesaId, userId), ausencia);
    return ausencia;
  }

  /**
   * Tenta reassumir o assento. Devolve a ausência quando ainda dá tempo, null quando a
   * janela já passou (ou a pessoa nem tinha caído).
   */
  reassumir(mesaId: string, userId: string): AusenciaDeJogador | null {
    const chave = this.chave(mesaId, userId);
    const ausencia = this.ausentes.get(chave);
    if (!ausencia) return null;
    if (Date.now() > ausencia.expiraEm) {
      this.ausentes.delete(chave);
      return null;
    }
    this.ausentes.delete(chave);
    return ausencia;
  }

  /** Quem estourou a janela. O JOGO decide o que fazer — aqui só se sabe quem foi. */
  expirados(agora = Date.now()): AusenciaDeJogador[] {
    const fora: AusenciaDeJogador[] = [];
    for (const [chave, ausencia] of this.ausentes) {
      if (agora > ausencia.expiraEm) {
        fora.push(ausencia);
        this.ausentes.delete(chave);
      }
    }
    return fora;
  }

  estaAusente(mesaId: string, userId: string): boolean {
    const ausencia = this.ausentes.get(this.chave(mesaId, userId));
    return Boolean(ausencia && Date.now() <= ausencia.expiraEm);
  }

  /** Mesa fechou: ninguém mais volta pra ela. */
  esquecerMesa(mesaId: string) {
    for (const [chave, ausencia] of this.ausentes) {
      if (ausencia.mesaId === mesaId) this.ausentes.delete(chave);
    }
  }
}
