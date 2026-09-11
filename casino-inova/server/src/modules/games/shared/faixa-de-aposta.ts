import { Injectable } from '@nestjs/common';

import { DegrauDoJogador, type QuemAposta } from './degrau-do-jogador.service';
import { degrauQueCabeNaConta } from './niveis-de-mesa';
import type { NivelDeMesa } from './niveis-de-mesa';

/**
 * A ENGINE DE APOSTA — quanto ESTE jogador pode apostar, e com quais fichas.
 *
 * O DEFEITO QUE ISTO VEIO MATAR foi visto na tela e depois provado por conferência: os
 * sete jogos contra a casa publicavam `minBet: NIVEIS_DE_MESA[0].minimo` — o mínimo do
 * BRONZE — para todo mundo, seja qual for o degrau de quem pergunta. O resultado, na tela
 * de quem tem 146 bilhões:
 *
 *     "O mínimo em Grande é 500.000.000 fichas"
 *     e, logo abaixo, um trilho oferecendo fichas de 50, 100, 250, 500 e 1.000.
 *
 * Não existe combinação dessas fichas que alcance o mínimo. A mesa fica matematicamente
 * inutilizável: a pessoa monta uma aposta e o servidor recusa, sempre.
 *
 * UMA FONTE SÓ, E POR JOGADOR. A escada de degraus já sabia a resposta certa — ela é
 * proporcional por construção (cada degrau entra com dez vezes o anterior, o mínimo é 1%
 * da entrada, e as fichas são mínimo × 1, 2, 5, 10 e 20). O que faltava era os jogos
 * PERGUNTAREM em vez de publicarem uma constante. Esta classe é esse lugar único: dez
 * jogos passam a ler a mesma resposta, e um jogo novo não tem como inventar a sua.
 *
 * O QUE ELA NÃO FAZ, de propósito: não inventa denominação fora da escada. Um trilho com
 * fichas "humanas" calculadas à parte (73.450, 146.900...) seria uma segunda régua
 * concorrendo com a que valida a aposta — e a aposta continuaria sendo validada pela
 * primeira. As cinco fichas do degrau JÁ são redondas e JÁ acompanham a ordem de grandeza
 * da banca; o trabalho aqui é publicá-las, não substituí-las.
 */
@Injectable()
export class FaixaDeAposta {
  constructor(private readonly degraus: DegrauDoJogador) {}

  /**
   * A faixa de aposta de quem está perguntando.
   *
   * @param apostasPorRodada quantas apostas o jogo aceita numa rodada só. A roleta aceita
   *   várias ao mesmo tempo, e a soma delas é que precisa caber no saldo — por isso a
   *   sugestão inicial é dividida, pra a tela não abrir já estourando o bolso.
   * @param maiorMultiplicador o maior retorno que ESTE jogo sabe pagar, em múltiplos da
   *   aposta. Serve pra o trilho parar onde a conta de fichas para de ser exata — ver
   *   `degrauQueCabeNaConta`. Sem ele, o trilho é o do degrau, sem teto de aritmética.
   */
  async de(userId: string, apostasPorRodada = 1, maiorMultiplicador?: number): Promise<FaixaPublicada> {
    const quem = await this.degraus.de(userId);
    return publicar(quem, apostasPorRodada, maiorMultiplicador);
  }
}

export interface FaixaPublicada {
  minBet: number;
  /**
   * O teto da MESA, que é a maior ficha do trilho — e não um limite de quanto se pode
   * apostar. Não existe aposta máxima neste projeto (ver `problemaComAAposta`): o que
   * existe é o limite do saldo. Este número serve pra tela desenhar o trilho.
   */
  maxBet: number;
  /** As cinco fichas do degrau, do menor pro maior. A menor É a aposta mínima. */
  fichas: number[];
  /** Só as fichas que o saldo de agora cobre — as outras a tela desenha apagadas. */
  fichasQuePodeGastar: number[];
  /** Onde o seletor abre. Nunca acima do que a pessoa tem, nunca abaixo do mínimo. */
  apostaInicial: number;
  saldo: number;
  degrau: { id: string; nome: string; minimo: number; maximo: number };
  /** Dá pra apostar? Falso quando o saldo não cobre nem a aposta mínima da mesa. */
  podeApostar: boolean;
}

function publicar(
  quem: QuemAposta,
  apostasPorRodada: number,
  maiorMultiplicador?: number,
): FaixaPublicada {
  /*
   * O DEGRAU PUBLICADO É O MESMO QUE A VALIDAÇÃO USA — e isso é a regra inteira deste
   * arquivo. `problemaComAAposta` recebe o mesmo `maiorMultiplicador` e chama a mesma
   * função; se a tela lesse um trilho e o servidor validasse por outro, estaríamos de
   * volta ao defeito que esta engine veio matar, só que com outra causa. Ver
   * `degrauQueCabeNaConta`: nos jogos que pagam muito, o trilho para onde a conta exata
   * para.
   */
  const degrau: NivelDeMesa = degrauQueCabeNaConta(quem.degrau, maiorMultiplicador);
  const cabe = (valor: number) => valor <= quem.saldo;

  /*
   * A APOSTA INICIAL É O MÍNIMO, e não a maior ficha que caiba.
   *
   * Abrir no máximo transforma um toque distraído em "apostei tudo". Abrir no mínimo é a
   * escolha conservadora, e quem quiser mais tem dobrar, metade e tudo a um toque —
   * decisão já registrada quando o seletor foi feito.
   */
  const inicial = Math.min(
    Math.max(degrau.minimo, Math.floor(quem.saldo / Math.max(1, apostasPorRodada))),
    degrau.minimo,
  );

  return {
    minBet: degrau.minimo,
    maxBet: degrau.maximo,
    fichas: degrau.fichas,
    fichasQuePodeGastar: degrau.fichas.filter(cabe),
    apostaInicial: cabe(degrau.minimo) ? inicial : 0,
    saldo: quem.saldo,
    degrau: { id: degrau.id, nome: degrau.nome, minimo: degrau.minimo, maximo: degrau.maximo },
    podeApostar: cabe(degrau.minimo),
  };
}
