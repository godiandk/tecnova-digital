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

class FulfillPurchaseDto {
  userId!: string;
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

@Controller('store')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

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

    const userId = body?.event?.app_user_id;
    const packageId = body?.event?.product_id;
    if (!userId || !packageId) {
      throw new BadRequestException('Evento sem app_user_id ou product_id.');
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
  async fulfillPurchase(@Body() body: FulfillPurchaseDto) {
    if (process.env.PERMITIR_COMPRA_DE_TESTE !== 'true') {
      throw new ForbiddenException(
        'Compra de teste desligada. Em produção a ficha só entra pelo webhook de compra validada.',
      );
    }
    if (!body?.userId || !body?.packageId) {
      throw new BadRequestException('Informe userId e packageId.');
    }
    return this.storeService.fulfillPurchase(body.userId, body.packageId);
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
