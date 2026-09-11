import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';
import { diaDoServidor } from '../../comum/dia-do-servidor';

/**
 * AS PROMOÇÕES DA LOJA — "esta semana, o pacote grande vem 50% maior".
 *
 * O QUE ELAS SÃO: uma linha com prazo, e não um `if` no código. Com um `if`, começar uma
 * promoção exige uma versão nova do servidor e TERMINAR exige outra — e a que termina é a
 * que alguém esquece. Aqui a janela é `starts_at`/`ends_at`, em dias do servidor (UTC), e
 * a promoção acaba sozinha.
 *
 * O QUE ELAS NÃO SÃO, e isto é regra do projeto, não preferência:
 *
 *   - NÃO EXISTE URGÊNCIA FABRICADA. `terminaEm` é a data real de fim, publicada pra tela
 *     dizer "termina domingo". Nada de relógio regressivo que reinicia quando a pessoa
 *     volta, nada de "restam 4 minutos" que são sempre 4 minutos.
 *   - NÃO EXISTE OFERTA QUE APARECE PORQUE A PESSOA PERDEU. A elegibilidade olha degrau e
 *     pacote — nunca o histórico de derrotas, nunca o saldo despencando. Uma loja que
 *     aparece exatamente quando alguém acabou de quebrar está vendendo desespero.
 *   - NÃO EXISTE PREÇO DIFERENTE PARA A MESMA PESSOA NO MESMO DIA. A promoção vale para
 *     todo mundo que está na faixa, e a faixa está escrita.
 *
 * O LIMITE POR PESSOA (`purchase_limit`) existe para o lado oposto: impedir que uma
 * promoção boa seja comprada mil vezes e vire uma porta de inflação. É teto, não gatilho.
 */
export interface Promocao {
  id: string;
  nome: string;
  bonusPercent: number;
  /** A data real de fim, em `AAAA-MM-DD`. A tela mostra ela, não um cronômetro. */
  terminaEm: string;
  /** Em que pacotes vale. Vazio = todos. */
  pacotes: string[];
  /** Em que degraus econômicos vale. Vazio = todos. */
  degraus: string[];
  /** Quantas vezes cada pessoa pode comprar com ela. Nulo = sem limite. */
  limitePorPessoa: number | null;
}

@Injectable()
export class Promocoes {
  constructor(private readonly db: DatabaseService) {}

  /**
   * As promoções valendo hoje.
   *
   * A janela é conferida no SQL com o dia vindo do CÓDIGO, e não com `CURRENT_DATE`:
   * `CURRENT_DATE` é a data no fuso do banco, e trocar o fuso do servidor moveria o começo
   * e o fim de toda promoção de uma vez.
   */
  async valendoHoje(hoje = diaDoServidor()): Promise<Promocao[]> {
    const linhas = await this.db.query<LinhaDePromocao>(
      `SELECT * FROM store_promotions
        WHERE ativa AND starts_at <= $1 AND ends_at >= $1
        ORDER BY bonus_percent DESC`,
      [hoje],
    );
    return linhas.map(paraPromocao);
  }

  /**
   * A melhor promoção que se aplica a este pacote, para esta pessoa.
   *
   * "Melhor" é a de maior bônus, e só UMA se aplica: promoções que empilham multiplicam
   * umas às outras e o resultado deixa de ser previsível por quem as cria. Uma de cada
   * vez é o que mantém a conta legível — para o jogador e para quem responde ao suporte.
   */
  async melhorPara(
    userId: string,
    pacoteId: string,
    degrauId: string,
    hoje = diaDoServidor(),
  ): Promise<Promocao | null> {
    const candidatas = (await this.valendoHoje(hoje)).filter(
      (p) =>
        (p.pacotes.length === 0 || p.pacotes.includes(pacoteId)) &&
        (p.degraus.length === 0 || p.degraus.includes(degrauId)),
    );
    if (candidatas.length === 0) return null;

    for (const promocao of candidatas) {
      if (promocao.limitePorPessoa === null) return promocao;
      const usos = await this.db.queryOne<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM purchases
          WHERE user_id = $1 AND promotion_id = $2 AND refunded_at IS NULL`,
        [userId, promocao.id],
      );
      if (Number(usos?.n ?? 0) < promocao.limitePorPessoa) return promocao;
    }
    return null;
  }

  /**
   * Quanto a promoção acrescenta, em fichas, por cima do pacote.
   *
   * Inteiro sempre, e arredondado para BAIXO: numa dúvida de meia ficha, a casa não
   * inventa a metade. É a mesma regra do resto do livro-caixa.
   */
  bonusEmFichas(chips: number, promocao: Promocao | null): number {
    if (!promocao) return 0;
    return Math.floor((chips * promocao.bonusPercent) / 100);
  }
}

interface LinhaDePromocao {
  promotion_id: string;
  nome: string;
  starts_at: string | Date;
  ends_at: string | Date;
  bonus_percent: number;
  package_ids: string[];
  eligible_tiers: string[];
  purchase_limit: number | null;
}

function paraPromocao(l: LinhaDePromocao): Promocao {
  return {
    id: l.promotion_id,
    nome: l.nome,
    bonusPercent: l.bonus_percent,
    terminaEm: l.ends_at instanceof Date ? l.ends_at.toISOString().slice(0, 10) : String(l.ends_at).slice(0, 10),
    pacotes: l.package_ids ?? [],
    degraus: l.eligible_tiers ?? [],
    limitePorPessoa: l.purchase_limit,
  };
}
