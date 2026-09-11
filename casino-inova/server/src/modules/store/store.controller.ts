import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';

import { StoreService } from './store.service';
import { Promocoes } from './promocoes';
import { PortaRevenueCat } from './porta-revenuecat';
import { moedaValida } from './pacotes';
import { UsuarioAtual } from '../auth/usuario-atual.decorator';
import { Publico } from '../auth/auth.guard';

class FulfillPurchaseDto {
  packageId!: string;
}

@Controller('store')
export class StoreController {
  /*
   * A PORTA DA REVENUECAT É A ÚNICA IMPLEMENTADA. Pix e cartão estão declarados em
   * `porta-de-pagamento.ts` e não têm implementação — não porque foram esquecidos, mas
   * porque pagamento fora da loja de aplicativo depende de um adquirente e de uma decisão
   * sobre as regras da Apple para bens digitais. Declarar sem implementar é melhor do que
   * implementar pela metade: o dia em que existir, a porta já diz o que ela precisa
   * entregar, e ninguém vai escrever uma quinta forma de creditar ficha num canto.
   */
  private readonly portas = [new PortaRevenueCat()];

  constructor(
    private readonly storeService: StoreService,
    private readonly promocoes: Promocoes,
  ) {}

  /**
   * A VITRINE PÚBLICA — a do Bronze, que é o que uma conta nova recebe de verdade.
   *
   * Continua pública porque a tela da loja precisa mostrar alguma coisa antes de a sessão
   * carregar, e porque o preço não é segredo. Quem está logado recebe `/store/minha`, com
   * o pacote do degrau dela.
   */
  @Publico()
  @Get('pacotes')
  listPackages(@Query('moeda') moeda?: string) {
    return this.storeService.listPackages(moedaValida(moeda));
  }

  /** A loja desta pessoa: os mesmos preços, com o pacote do degrau e do nível dela. */
  @Get('minha')
  minhaLoja(@UsuarioAtual() usuarioLogado: string, @Query('moeda') moeda?: string) {
    return this.storeService.lojaDe(usuarioLogado, moedaValida(moeda));
  }

  /** As promoções valendo hoje. Vazio quando não há — e isso não é escondido. */
  @Get('promocoes')
  promocoesDeHoje() {
    return this.promocoes.valendoHoje();
  }

  @Get('minhas-compras')
  minhasCompras(@UsuarioAtual() usuarioLogado: string) {
    return this.storeService.historicoDe(usuarioLogado);
  }

  /**
   * Caminho de PRODUÇÃO: a compra acontece na App Store / Play Store, a RevenueCat valida
   * o recibo com a loja e chama este webhook. Só ela consegue chamar aqui, porque só ela
   * tem o segredo compartilhado.
   *
   * Público no sentido do guard de sessão — o provedor de pagamento não tem, e nunca vai
   * ter, um token de jogador. Quem tranca esta porta é a assinatura HMAC, conferida dentro
   * da porta. Sem este `@Publico()`, o guard global recusaria o webhook com 401 e nenhuma
   * compra seria creditada nunca.
   */
  @Publico()
  @Post('webhook/compra')
  async handlePurchaseWebhook(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const porta = this.portas.find((p) => p.configurada());
    if (!porta) throw new ForbiddenException('Webhook de compra não configurado neste servidor.');

    let evento;
    try {
      evento = porta.interpretar(body, { authorization });
    } catch (erro) {
      throw new UnauthorizedException(erro instanceof Error ? erro.message : 'Assinatura inválida.');
    }

    if (evento.tipo === 'estorno') {
      return this.storeService.registrarEstorno(evento.dados.eventoId, evento.dados.userId);
    }
    if (evento.tipo === 'ignorado') {
      /*
       * Responde 200 mesmo assim: devolver erro faz o provedor reenviar o mesmo evento de
       * novo e de novo, para sempre, achando que caímos.
       */
      return { ignorado: true, porque: evento.porque };
    }
    return this.storeService.fulfillPurchase(evento.dados);
  }

  /**
   * Caminho de TESTE, e só isso.
   *
   * Este endpoint credita ficha sem ninguém ter pago nada. Ele existe para dar para
   * exercitar o resto do fluxo (carteira, loja, jogo) sem depender de loja de aplicativo —
   * mas em produção seria fichas de graça para quem descobrisse o endereço.
   *
   * Por isso ele só responde quando `PERMITIR_COMPRA_DE_TESTE=true` está definida.
   * Produção simplesmente não define, e aí a rota recusa. Deixar trancado por padrão (em
   * vez de destrancado com um aviso no README) é o que garante que esquecer de configurar
   * erra para o lado seguro.
   */
  @Post('comprar')
  async fulfillPurchase(@UsuarioAtual() usuarioLogado: string, @Body() body: FulfillPurchaseDto) {
    if (process.env.PERMITIR_COMPRA_DE_TESTE !== 'true') {
      throw new ForbiddenException(
        'Compra de teste desligada. Em produção a ficha só entra pelo webhook de compra validada.',
      );
    }
    if (!body?.packageId) throw new BadRequestException('Informe packageId.');

    return this.storeService.fulfillPurchase({
      /* Um id por chamada: sem ele, a segunda compra de teste seria tratada como reentrega. */
      eventoId: `teste:${usuarioLogado}:${Date.now()}`,
      userId: usuarioLogado,
      pacoteId: body.packageId,
      precoEmCentavos: 0,
      moeda: '',
      porta: 'revenuecat',
    });
  }
}
