import { Injectable } from '@nestjs/common';

/**
 * O log sequencial de tudo que acontece numa mesa.
 *
 * Serve pra três coisas que hoje não dá pra fazer:
 *
 * 1. RECONEXÃO. Quem caiu volta dizendo "vi até o evento 47" e recebe do 48 pra frente,
 *    em vez de receber o estado inteiro e perder o que aconteceu no meio.
 * 2. AUDITORIA. Dá pra reconstruir uma rodada inteira e responder "por que essa pessoa
 *    perdeu" com o que de fato aconteceu, não com o estado final.
 * 3. ORDEM. `seq` é a única ordem que existe. Mensagem de rede chega fora de ordem; o
 *    número não.
 *
 * Vive em memória nesta versão, com um teto por mesa. É o suficiente pra reconexão (que
 * acontece em segundos) e pra depurar uma rodada; auditoria de verdade precisa disto no
 * Postgres, na tabela `game_events` da especificação, e é o passo seguinte.
 */
export interface EventoDaMesa {
  seq: number;
  mesaId: string;
  rodadaId: string | null;
  tipo: string;
  /** O que aconteceu. Nunca carrega carta privada — ver a nota em `anotar`. */
  dados: unknown;
  em: number;
}

/** Quantos eventos ficam guardados por mesa. Cobre folgado a janela de reconexão. */
const TETO_POR_MESA = 500;

@Injectable()
export class RegistroDeEventos {
  private readonly porMesa = new Map<string, EventoDaMesa[]>();
  private readonly proximoSeq = new Map<string, number>();

  /**
   * Anota um evento e devolve o número dele.
   *
   * IMPORTANTE: `dados` entra no que é reenviado na reconexão, e a reconexão manda o
   * histórico pra QUEM PEDIU. Então aqui só pode entrar o que é público. Carta na mão de
   * alguém vai por `ESTADO_PRIVADO`, direto pro dono, e nunca passa por este registro.
   */
  anotar(mesaId: string, rodadaId: string | null, tipo: string, dados: unknown): EventoDaMesa {
    const seq = (this.proximoSeq.get(mesaId) ?? 0) + 1;
    this.proximoSeq.set(mesaId, seq);

    const evento: EventoDaMesa = { seq, mesaId, rodadaId, tipo, dados, em: Date.now() };
    const lista = this.porMesa.get(mesaId) ?? [];
    lista.push(evento);
    // Descarta os mais antigos, nunca os mais novos: quem volta precisa do fim da fila.
    if (lista.length > TETO_POR_MESA) lista.splice(0, lista.length - TETO_POR_MESA);
    this.porMesa.set(mesaId, lista);
    return evento;
  }

  /**
   * O que aconteceu depois de `ultimoVisto`. Vazio quando não faltou nada.
   *
   * Devolve `null` quando o pedaço pedido já saiu do registro — nesse caso quem volta
   * precisa do estado inteiro, e mandar um pedaço do meio seria pior do que não mandar
   * nada: a mesa ficaria montada errada, sem ninguém perceber.
   */
  desde(mesaId: string, ultimoVisto: number): EventoDaMesa[] | null {
    const lista = this.porMesa.get(mesaId) ?? [];
    if (lista.length === 0) return [];
    if (ultimoVisto < 0) return null;

    const maisAntigo = lista[0].seq;
    if (ultimoVisto + 1 < maisAntigo) return null;
    return lista.filter((e) => e.seq > ultimoVisto);
  }

  seqAtual(mesaId: string): number {
    return this.proximoSeq.get(mesaId) ?? 0;
  }

  /** Chamado quando a mesa fecha, pra a memória não crescer sem fim. */
  esquecer(mesaId: string) {
    this.porMesa.delete(mesaId);
    this.proximoSeq.delete(mesaId);
  }
}
