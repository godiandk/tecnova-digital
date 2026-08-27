import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { StoreService } from './store.service';
import { UsuarioAtual } from '../auth/usuario-atual.decorator';
import { Publico } from '../auth/auth.guard';

class FulfillPurchaseDto {
  packageId!: string;
}

/**
 * O corpo que a RevenueCat manda no webhook. Só interessam três campos; o resto do
 * payload dela é ignorado de propósito, pra a integração não quebrar quando ela
 * acrescentar coisa nova.
 */
class WebhookDto {
  event!: {
    type?: string;
    app_user_id?: string;
    product_id?: string;
    /** Id do evento — é o que impede creditar duas vezes se ela reenviar. */
    id?: string;
  };
}

/**
 * Tipos de evento que significam "entrou dinheiro". Consumível (nossos pacotes de
 * ficha) chega como NON_RENEWING_PURCHASE; os outros são de assinatura, e estão aqui
 * pra o dia em que existir um passe mensal.
 */
const EVENTOS_DE_COMPRA = ['INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE', 'RENEWAL'];

/** Saiu dinheiro: a compra foi desfeita depois de já ter sido paga. */
const EVENTOS_DE_ESTORNO = ['REFUND', 'CANCELLATION'];

@Controller('store')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  @Publico()
  @Get('pacotes')
  listPackages() {
    return this.storeService.listPackages();
  }

  /**
   * Caminho de PRODUÇÃO: a compra acontece na App Store / Play Store, a RevenueCat
   * valida o recibo com a loja e chama este webhook. Só ela consegue chamar aqui,
   * porque só ela tem o segredo compartilhado.
   *
   * A assinatura é conferida com `timingSafeEqual` em vez de `===`: comparação de
   * string comum para no primeiro byte diferente, e o tempo que ela leva vaza quantos
   * bytes iniciais o atacante já acertou — dá pra descobrir a assinatura byte a byte.
   */
  /*
   * Público no sentido do guard de sessão — o provedor de pagamento não tem, e nunca
   * vai ter, um token de jogador. Quem tranca esta porta é a assinatura HMAC logo
   * abaixo. Sem este @Publico(), o guard global recusaria o webhook com 401 e nenhuma
   * compra seria creditada nunca.
   */
  @Publico()
  @Post('webhook/compra')
  async handlePurchaseWebhook(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: WebhookDto,
  ) {
    const segredo = process.env.PURCHASE_WEBHOOK_SECRET;
    if (!segredo) {
      throw new ForbiddenException('Webhook de compra não configurado neste servidor.');
    }
    if (!assinaturaConfere(authorization, body, segredo)) {
      throw new UnauthorizedException('Assinatura inválida.');
    }

    const tipo = (body?.event?.type ?? '').toUpperCase();
    const userId = body?.event?.app_user_id;
    const packageId = body?.event?.product_id;
    if (!userId || !packageId) {
      throw new BadRequestException('Evento sem app_user_id ou product_id.');
    }

    /*
     * O TIPO do evento decide o que fazer, e ignorar isso é caro.
     *
     * O provedor manda muito mais que "comprou": manda cancelamento, expiração,
     * problema de cobrança, transferência de conta e ESTORNO. Se a gente creditasse em
     * todo evento, bastaria comprar, receber as fichas, pedir o dinheiro de volta — e
     * o evento de estorno creditaria as fichas outra vez. A pessoa ficaria com o
     * dobro das fichas e sem ter pago nada.
     */
    if (EVENTOS_DE_ESTORNO.includes(tipo)) {
      return this.storeService.registrarEstorno(body.event.id!, userId);
    }

    if (!EVENTOS_DE_COMPRA.includes(tipo)) {
      /*
       * Tipo que não movimenta ficha (cancelamento de renovação, aviso de cobrança).
       * Responde 200 assim mesmo: devolver erro faz o provedor reenviar o mesmo evento
       * de novo e de novo, pra sempre, achando que a gente caiu.
       */
      return { ignorado: true, tipo };
    }

    return this.storeService.fulfillPurchase(userId, packageId, body.event.id);
  }

  /**
   * Caminho de TESTE, e só isso.
   *
   * Este endpoint credita ficha sem ninguém ter pago nada. Ele existe pra dar pra
   * exercitar o resto do fluxo (carteira, loja, jogo) sem depender de loja de
   * aplicativo — mas em produção seria fichas de graça pra quem descobrisse o
   * endereço.
   *
   * Por isso ele só responde quando `PERMITIR_COMPRA_DE_TESTE=true` está definida.
   * Produção simplesmente não define, e aí a rota recusa. Deixar trancado por padrão
   * (em vez de destrancado com um aviso no README) é o que garante que esquecer de
   * configurar erra pro lado seguro.
   */
  @Post('comprar')
  async fulfillPurchase(@UsuarioAtual() usuarioLogado: string, @Body() body: FulfillPurchaseDto) {
    if (process.env.PERMITIR_COMPRA_DE_TESTE !== 'true') {
      throw new ForbiddenException(
        'Compra de teste desligada. Em produção a ficha só entra pelo webhook de compra validada.',
      );
    }
    if (!body?.packageId) {
      throw new BadRequestException('Informe packageId.');
    }
    return this.storeService.fulfillPurchase(usuarioLogado, body.packageId);
  }
}

/** `Authorization: Bearer <hmac-sha256 do corpo, em hex>`. */
function assinaturaConfere(authorization: string | undefined, body: unknown, segredo: string): boolean {
  const recebida = authorization?.replace(/^Bearer\s+/i, '') ?? '';
  const esperada = createHmac('sha256', segredo).update(JSON.stringify(body)).digest('hex');
  const a = Buffer.from(recebida);
  const b = Buffer.from(esperada);
  // timingSafeEqual exige o mesmo tamanho — tamanho diferente já é assinatura errada.
  return a.length === b.length && timingSafeEqual(a, b);
}
