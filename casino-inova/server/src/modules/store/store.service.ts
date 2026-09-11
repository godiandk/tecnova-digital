import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { WalletService } from '../wallet/wallet.service';
import { DatabaseService } from '../../database/database.service';
import { DegrauDoJogador } from '../games/shared/degrau-do-jogador.service';
import { bonusDeNivel } from '../recompensas/calendario';
import { Promocoes } from './promocoes';
import {
  DEGRAU_DE_VITRINE,
  type Moeda,
  MOEDA_PADRAO,
  type PacoteOferecido,
  PRECOS,
  escreverPreco,
  fichasDoPacote,
} from './pacotes';
import type { PagamentoConfirmado } from './porta-de-pagamento';

@Injectable()
export class StoreService {
  private readonly logger = new Logger(StoreService.name);

  constructor(
    private readonly walletService: WalletService,
    private readonly db: DatabaseService,
    private readonly degraus: DegrauDoJogador,
    private readonly promocoes: Promocoes,
  ) {}

  /**
   * A VITRINE PÚBLICA — o que a loja mostra pra quem ainda não entrou.
   *
   * É a do Bronze, e é honesta: é exatamente o que uma conta nova recebe. Mostrar a
   * vitrine do degrau mais alto pra atrair seria anunciar um pacote que quem chega não vai
   * receber.
   */
  listPackages(moeda: Moeda = MOEDA_PADRAO): PacoteOferecido[] {
    return Object.entries(PRECOS).map(([id, preco]) => ({
      id,
      chips: fichasDoPacote(preco.k, DEGRAU_DE_VITRINE, 1),
      apostasMinimas: preco.k,
      moeda,
      precoEmCentavos: preco.precos[moeda],
      precoEscrito: escreverPreco(preco.precos[moeda], moeda),
      degrau: { id: DEGRAU_DE_VITRINE.id, nome: DEGRAU_DE_VITRINE.nome, minimo: DEGRAU_DE_VITRINE.minimo },
      bonusDeNivel: 1,
      bonusDePromocao: 0,
    }));
  }

  /**
   * A LOJA DESTA PESSOA — os mesmos quatro preços, com o pacote do degrau dela.
   *
   * Era uma lista de quatro números fixos, iguais pra todo mundo, enquanto a mesa em que se
   * joga multiplica por dez a cada degrau: o maior pacote pago comprava uma banca inteira
   * no Bronze e NEM UMA APOSTA no Rubi. Acima do Ouro a loja não era cara nem barata —
   * era irrelevante, que é pior.
   *
   * O DEGRAU É O ECONÔMICO, e é essa palavra que impede a loja de virar catraca: comprar
   * aumenta o saldo, saldo maior subiria o degrau, degrau maior aumentaria o pacote
   * seguinte. Com o freio do nível, o degrau só sobe jogando, e a espiral não fecha.
   */
  async lojaDe(userId: string, moeda: Moeda = MOEDA_PADRAO): Promise<PacoteOferecido[]> {
    const quem = await this.degraus.de(userId);
    const bonus = bonusDeNivel(quem.nivel);

    return Promise.all(
      Object.entries(PRECOS).map(async ([id, preco]) => {
        const chips = fichasDoPacote(preco.k, quem.degrau, quem.nivel);
        const promocao = await this.promocoes.melhorPara(userId, id, quem.degrau.id);
        const bonusDePromocao = this.promocoes.bonusEmFichas(chips, promocao);
        return {
          id,
          chips: chips + bonusDePromocao,
          /*
           * QUANTAS APOSTAS MÍNIMAS, e não só quantas fichas. É o número que diz se o
           * pacote significa alguma coisa na mesa em que a pessoa joga — "120 mil fichas"
           * não diz nada; "2.400 rodadas" diz tudo.
           */
          apostasMinimas: Math.floor((chips + bonusDePromocao) / quem.degrau.minimo),
          moeda,
          precoEmCentavos: preco.precos[moeda],
          precoEscrito: escreverPreco(preco.precos[moeda], moeda),
          degrau: { id: quem.degrau.id, nome: quem.degrau.nome, minimo: quem.degrau.minimo },
          bonusDeNivel: bonus,
          bonusDePromocao,
          promocao: promocao
            ? {
                id: promocao.id,
                nome: promocao.nome,
                bonusPercent: promocao.bonusPercent,
                /* A data real de fim. A tela diz "termina domingo" — não um cronômetro. */
                terminaEm: promocao.terminaEm,
              }
            : undefined,
        };
      }),
    );
  }

  /**
   * Credita as fichas de uma compra CONFIRMADA PELO PROVEDOR.
   *
   * A QUANTIDADE DE FICHAS É CALCULADA AQUI, e nunca lida do evento. O provedor diz qual
   * pacote foi comprado; quanto isso vale sai do degrau e do nível de quem comprou. Aceitar
   * um `chips` vindo de fora seria aceitar um valor calculado do lado de lá — a porta que
   * este projeto fecha em todo lugar.
   *
   * `eventoId` é a chave de idempotência: se o provedor reenviar o mesmo evento (o que é
   * normal quando ele não recebe o 200), a segunda chamada não credita nada e devolve a
   * mesma resposta. Sem isso, uma reentrega dobraria as fichas de quem pagou uma vez só.
   */
  async fulfillPurchase(pagamento: PagamentoConfirmado) {
    const preco = PRECOS[pagamento.pacoteId];
    if (!preco) throw new NotFoundException('Pacote de fichas não encontrado.');

    const quem = await this.degraus.de(pagamento.userId);
    const base = fichasDoPacote(preco.k, quem.degrau, quem.nivel);
    const promocao = await this.promocoes.melhorPara(pagamento.userId, pagamento.pacoteId, quem.degrau.id);
    const bonusDePromocao = this.promocoes.bonusEmFichas(base, promocao);
    const chips = base + bonusDePromocao;

    const creditou = await this.db.transaction(async (client) => {
      const { rowCount } = await client.query(
        `INSERT INTO purchases
           (provider_event_id, user_id, package_id, chips, promotion_id, bonus_percent,
            tier_id, level, price_cents, currency, provider)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING`,
        [
          pagamento.eventoId,
          pagamento.userId,
          pagamento.pacoteId,
          chips,
          promocao?.id ?? null,
          promocao?.bonusPercent ?? null,
          quem.degrau.id,
          quem.nivel,
          pagamento.precoEmCentavos || null,
          pagamento.moeda || null,
          pagamento.porta,
        ],
      );
      if (rowCount === 0) return false; // evento repetido: não credita de novo
      await this.walletService.creditInTransaction(client, pagamento.userId, chips, 'compra', pagamento.pacoteId);
      return true;
    });

    return {
      pacote: pagamento.pacoteId,
      chips,
      bonusDePromocao,
      degrau: quem.degrau.nome,
      nivel: quem.nivel,
      repetido: !creditou,
      newBalance: await this.walletService.balanceOf(pagamento.userId),
    };
  }

  /**
   * A compra foi estornada.
   *
   * As fichas NÃO são retiradas automaticamente, e isso é decisão, não esquecimento: a
   * pessoa pode já ter apostado tudo, e forçar o débito deixaria a carteira negativa — um
   * estado que o ledger não deveria conhecer. Fica marcado aqui pro suporte ver, decidir e
   * agir (tem rota de conceder e a de banir).
   *
   * Marcar em vez de agir sozinho também protege o caso legítimo: cobrança duplicada pelo
   * próprio provedor, compra que a criança fez no cartão do pai. Nem todo estorno é fraude.
   */
  async registrarEstorno(providerEventId: string, userId: string) {
    const linha = await this.db.queryOne<{ package_id: string; chips: string }>(
      `UPDATE purchases SET refunded_at = now()
        WHERE provider_event_id = $1 AND refunded_at IS NULL
        RETURNING package_id, chips`,
      [providerEventId],
    );

    if (!linha) {
      // Estorno de uma compra que não conhecemos, ou já marcada. Não é erro: responder 200
      // evita o provedor reenviar pra sempre.
      return { estorno: true, jaRegistrado: true };
    }

    this.logger.warn(
      `Estorno registrado: usuário ${userId}, pacote ${linha.package_id} (${linha.chips} fichas). ` +
        'As fichas NÃO foram retiradas — precisa de decisão do suporte.',
    );
    return { estorno: true, userId, packageId: linha.package_id, chips: Number(linha.chips) };
  }

  /** As compras desta pessoa, com o que explicava o tamanho de cada pacote. */
  async historicoDe(userId: string, limite = 50) {
    const linhas = await this.db.query<LinhaDeCompra>(
      `SELECT * FROM purchases WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, Math.max(1, Math.min(365, Math.floor(limite)))],
    );
    return linhas.map((l) => ({
      pacote: l.package_id,
      chips: Number(l.chips),
      degrau: l.tier_id,
      nivel: l.level,
      promocao: l.promotion_id,
      bonusPercent: l.bonus_percent,
      preco: l.price_cents !== null && l.currency ? escreverPreco(l.price_cents, l.currency as Moeda) : null,
      porta: l.provider,
      estornada: l.refunded_at !== null,
      em: l.created_at,
    }));
  }
}

interface LinhaDeCompra {
  package_id: string;
  chips: string;
  tier_id: string | null;
  level: number | null;
  promotion_id: string | null;
  bonus_percent: number | null;
  price_cents: number | null;
  currency: string | null;
  provider: string | null;
  refunded_at: Date | null;
  created_at: Date;
}
