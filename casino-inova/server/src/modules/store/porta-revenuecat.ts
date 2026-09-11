import { createHmac, timingSafeEqual } from 'crypto';

import type { EventoDePagamento, PortaDePagamento } from './porta-de-pagamento';

/**
 * A PORTA DA REVENUECAT — Apple Pay e Google Pay, que é como a compra de ficha acontece
 * dentro das lojas de aplicativo.
 *
 * Ela já existia, dentro do controller. Saiu de lá por um motivo prático: com Pix e cartão
 * no plano, "conferir a assinatura e traduzir o evento" precisa acontecer uma vez por
 * provedor, e não uma vez dentro de um `if` que cresce. O que o controller faz agora é
 * escolher a porta e agir sobre o resultado.
 *
 * A ASSINATURA É CONFERIDA COM `timingSafeEqual`, e não com `===`. Comparação de string
 * comum para no primeiro byte diferente, e o tempo que ela leva vaza quantos bytes
 * iniciais o atacante já acertou — dá para descobrir a assinatura byte a byte.
 */
export class PortaRevenueCat implements PortaDePagamento {
  readonly nome = 'revenuecat' as const;

  configurada(): boolean {
    return Boolean(process.env.PURCHASE_WEBHOOK_SECRET);
  }

  interpretar(corpo: unknown, cabecalhos: Record<string, string | undefined>): EventoDePagamento {
    const segredo = process.env.PURCHASE_WEBHOOK_SECRET;
    if (!segredo) throw new Error('Webhook de compra não configurado neste servidor.');
    if (!assinaturaConfere(cabecalhos.authorization, corpo, segredo)) {
      throw new Error('Assinatura inválida.');
    }

    const evento = (corpo as CorpoDaRevenueCat)?.event ?? {};
    const tipo = (evento.type ?? '').toUpperCase();
    const userId = evento.app_user_id;
    const pacoteId = evento.product_id;
    const eventoId = evento.id;

    /*
     * O TIPO DO EVENTO DECIDE O QUE FAZER, e ignorar isso é caro. O provedor manda muito
     * mais que "comprou": cancelamento, expiração, problema de cobrança, transferência de
     * conta e ESTORNO. Creditando em todo evento, bastaria comprar, receber as fichas e
     * pedir o dinheiro de volta — e o evento de estorno creditaria de novo. A pessoa
     * ficaria com o dobro das fichas sem ter pago nada.
     */
    if (EVENTOS_DE_ESTORNO.includes(tipo)) {
      if (!eventoId || !userId) return { tipo: 'ignorado', porque: 'estorno sem id ou sem usuário' };
      return { tipo: 'estorno', dados: { eventoId, userId, porta: this.nome } };
    }

    if (!EVENTOS_DE_COMPRA.includes(tipo)) {
      /*
       * Tipo que não movimenta ficha. Vira "ignorado" e não erro: devolver erro faz o
       * provedor reenviar o mesmo evento de novo e de novo, para sempre, achando que
       * caímos.
       */
      return { tipo: 'ignorado', porque: `tipo ${tipo || '(vazio)'} não movimenta ficha` };
    }

    if (!userId || !pacoteId || !eventoId) {
      return { tipo: 'ignorado', porque: 'evento de compra sem app_user_id, product_id ou id' };
    }

    return {
      tipo: 'compra',
      dados: {
        eventoId,
        userId,
        pacoteId,
        /*
         * O PREÇO VEM DO EVENTO SÓ PARA O REGISTRO, e nunca entra na conta das fichas. Ele
         * é o que a loja de aplicativo cobrou de verdade, na moeda da região — guardá-lo é
         * o que permite ao suporte conferir depois. Quantas fichas isso vale é decisão
         * daqui, a partir do pacote, do degrau e do nível.
         */
        precoEmCentavos: Math.round(Number(evento.price_in_purchased_currency ?? 0) * 100) || 0,
        moeda: (evento.currency ?? '').toUpperCase() || 'BRL',
        porta: this.nome,
      },
    };
  }
}

/**
 * Tipos de evento que significam "entrou dinheiro". Consumível (nossos pacotes de ficha)
 * chega como NON_RENEWING_PURCHASE; os outros são de assinatura, e estão aqui para o dia
 * em que existir um passe mensal.
 */
const EVENTOS_DE_COMPRA = ['INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE', 'RENEWAL'];

/** Saiu dinheiro: a compra foi desfeita depois de já ter sido paga. */
const EVENTOS_DE_ESTORNO = ['REFUND', 'CANCELLATION'];

interface CorpoDaRevenueCat {
  event?: {
    type?: string;
    app_user_id?: string;
    product_id?: string;
    id?: string;
    price_in_purchased_currency?: number;
    currency?: string;
  };
}

/** `Authorization: Bearer <hmac-sha256 do corpo, em hex>`. */
function assinaturaConfere(authorization: string | undefined, corpo: unknown, segredo: string): boolean {
  const recebida = authorization?.replace(/^Bearer\s+/i, '') ?? '';
  const esperada = createHmac('sha256', segredo).update(JSON.stringify(corpo)).digest('hex');
  const a = Buffer.from(recebida);
  const b = Buffer.from(esperada);
  // timingSafeEqual exige o mesmo tamanho — tamanho diferente já é assinatura errada.
  return a.length === b.length && timingSafeEqual(a, b);
}
