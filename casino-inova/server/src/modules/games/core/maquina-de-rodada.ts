import { Injectable } from '@nestjs/common';

import type { FaseDaRodada } from '../../../protocolo';
import { acrescentarAoContexto } from '../../../observabilidade/contexto-do-pedido';
import { registro } from '../../../observabilidade/registro';
import { podeIrPara } from './fases';
import { RodadasRepository } from './rodadas.repository';

/**
 * A MÁQUINA DE FASES, do jeito que um jogo de um lance só usa.
 *
 * A máquina em `fases.ts` existia desde sempre e um jogo de dez a usava. Nos outros
 * nove, "não dá pra apostar depois do fechamento" ou era resolvido de um jeito diferente
 * em cada um, ou não era resolvido — e cada rodada acontecia sem deixar registro nenhum
 * além do extrato.
 *
 * A maior parte dos nossos jogos é de UM LANCE: aposta, sorteia e paga numa requisição
 * só. Não existe janela em que a mesa fica esperando. Isso não torna a máquina inútil —
 * torna a passagem pelas fases uma coisa que acontece dentro do pedido, e o valor dela é
 * outro: a rodada fica registrada com as fases por onde passou, na ordem, e uma
 * sequência impossível estoura na hora em vez de virar um estado esquisito no banco.
 *
 * POR QUE NÃO GRAVA FASE POR FASE. Seriam oito idas ao banco por giro, num jogo em que a
 * pessoa gira dezenas de vezes por minuto. A transição é conferida na hora, em memória
 * (é o `podeIrPara` que faz isso, e ele estoura na sequência errada), e o banco recebe
 * dois pedaços: o que precisa existir ANTES de o dinheiro se mexer, e o que só existe
 * depois. A ordem entre os dois é o que impede o pior caso — dinheiro movido sem rodada
 * que o explique.
 */

export interface LanceRegistrado {
  /** O id da rodada. É ele que vai no extrato e é por ele que uma reclamação é achada. */
  id: string;
  /**
   * Anota algo que o jogador fez no meio da rodada — pedir carta, dobrar, dividir,
   * aceitar seguro, passar a vez.
   *
   * Só faz sentido nos jogos em que a rodada tem TURNOS. Num jogo de um lance não há
   * meio: a rodada inteira acontece dentro de uma requisição.
   */
  anotar(tipo: string, dados?: Record<string, unknown>): Promise<void>;
  /** Fecha a rodada: grava o resultado, o pagamento e as fases finais. */
  terminar(fim: {
    resultado: unknown;
    apostado: number;
    retorno: number;
    detalhe?: Record<string, unknown>;
    /**
     * A rodada teve decisão do jogador (pedir carta, dobrar, trucar, jogar peça).
     *
     * Muda o caminho de fases conferido: com decisão, a máquina passa por
     * ACOES_DOS_JOGADORES entre o sorteio e a apuração. Sem, vai direto — e é isso que
     * separa um blackjack de um giro de caça-níqueis.
     */
    comAcoesDoJogador?: boolean;
  }): Promise<void>;
}

@Injectable()
export class MaquinaDeRodada {
  constructor(private readonly rodadas: RodadasRepository) {}

  /**
   * Abre uma rodada de um lance e registra as apostas — ANTES de qualquer débito.
   *
   * A ordem é a coisa mais importante deste arquivo. Se o processo morrer entre o débito
   * e o registro, sobra dinheiro movido sem nada que o explique — que é exatamente a
   * situação que estas tabelas vieram acabar. Registrando primeiro, o pior caso vira uma
   * rodada aberta sem resultado, que é visível, achável (`abertas()`) e honesta: "esta
   * rodada começou e não terminou".
   */
  async comecar(entrada: {
    jogo: string;
    usuarioId: string;
    apostas: unknown;
    mesa?: string | null;
  }): Promise<LanceRegistrado> {
    const id = crypto.randomUUID();

    /*
     * As fases são conferidas mesmo sem ir ao banco. Um jogo que um dia inventar uma
     * sequência impossível descobre aqui, e não numa consulta seis meses depois.
     */
    exigirCaminho(['ESPERANDO_JOGADORES', 'RODADA_ABERTA', 'APOSTAS_ABERTAS', 'APOSTAS_FECHADAS']);

    await this.rodadas.abrir({
      id,
      jogo: entrada.jogo,
      mesa: entrada.mesa ?? null,
      estado: 'APOSTAS_FECHADAS',
    });
    await this.rodadas.anotar(id, {
      tipo: 'APOSTAS_CONFIRMADAS',
      usuarioId: entrada.usuarioId,
      dados: { apostas: entrada.apostas },
    });
    await this.rodadas.mudarEstado(id, 'APOSTAS_FECHADAS', { apostasFechadas: true });

    /*
     * A partir daqui, TODA linha deste pedido carrega o jogo e o número da rodada — sem
     * ninguém precisar passar nada adiante. É o que liga uma reclamação ("girei às 14h32
     * e não pagou") às tabelas do P0.2, que contam a rodada por dentro.
     */
    acrescentarAoContexto({ jogo: entrada.jogo, rodada: id });
    registro.info('rodada', 'aberta', { apostas: entrada.apostas });

    const rodadas = this.rodadas;
    return {
      id,
      async anotar(tipo, dados) {
        await rodadas.anotar(id, { tipo, usuarioId: entrada.usuarioId, dados: dados ?? {} });
      },
      async terminar(fim) {
        exigirCaminho(
          fim.comAcoesDoJogador
            ? ['APOSTAS_FECHADAS', 'SORTEIO', 'ACOES_DOS_JOGADORES', 'APURACAO', 'PAGAMENTO', 'RODADA_FECHADA']
            : ['APOSTAS_FECHADAS', 'SORTEIO', 'APURACAO', 'PAGAMENTO', 'RODADA_FECHADA'],
        );
        await rodadas.anotar(id, {
          tipo: 'SORTEIO',
          usuarioId: entrada.usuarioId,
          dados: { resultado: fim.resultado },
        });
        await rodadas.anotar(id, {
          tipo: 'LIQUIDADA',
          usuarioId: entrada.usuarioId,
          dados: { apostado: fim.apostado, retorno: fim.retorno, ...(fim.detalhe ?? {}) },
        });
        await rodadas.mudarEstado(id, 'RODADA_FECHADA', {
          decidida: true,
          fechada: true,
          resultado: fim.resultado,
        });
        registro.info('rodada', 'liquidada', {
          apostado: fim.apostado,
          retorno: fim.retorno,
          /* O saldo do jogador NÃO entra: quem quer saldo lê o extrato, que é a fonte. */
          comAcoesDoJogador: fim.comAcoesDoJogador === true,
        });
      },
    };
  }
}

/**
 * Confere um caminho inteiro de fases contra a máquina compartilhada.
 *
 * Existe pra que a sequência que um jogo de um lance percorre seja VERIFICADA, e não
 * assumida. Se alguém mexer em `fases.ts` e tirar uma transição que estes jogos usam,
 * eles param na hora, com o nome das duas fases — em vez de continuarem gravando um
 * caminho que a máquina não permite mais.
 */
function exigirCaminho(fases: FaseDaRodada[]): void {
  for (let i = 1; i < fases.length; i += 1) {
    if (!podeIrPara(fases[i - 1], fases[i])) {
      throw new Error(
        `Fase impossível: ${fases[i - 1]} -> ${fases[i]}. ` +
          'A máquina em core/fases.ts não permite essa transição.',
      );
    }
  }
}
