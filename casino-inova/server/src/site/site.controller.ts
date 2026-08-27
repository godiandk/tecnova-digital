import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { join } from 'path';
import { Publico } from '../modules/auth/auth.guard';
import { PASTA_DO_SITE } from './pasta-do-site';

/**
 * A rota de sobra do app de página única.
 *
 * Qualquer endereço que não bata com uma rota de API devolve o index.html, pra que
 * recarregar a página dentro do app (ou abrir um link direto) não dê 404.
 *
 * Duas coisas fazem isso funcionar sem atropelar a API:
 *
 * 1. **Este módulo é o ÚLTIMO importado no AppModule.** O Nest casa as rotas na ordem
 *    em que foram registradas, então toda rota de verdade é testada antes deste
 *    curinga. Subir este import na lista quebraria a API inteira em silêncio: o
 *    servidor responderia index.html pra /wallet/saldo.
 *
 * 2. **É um controller, e não um middleware avulso.** Middleware registrado depois do
 *    `app.init()` nunca roda: o Nest instala o próprio tratador de 404 durante o init,
 *    no fim da pilha do Express, e ele responde antes.
 */
@Controller()
export class SiteController {
  @Publico()
  @Get('*')
  entregarOSite(@Res() res: Response) {
    res.sendFile(join(PASTA_DO_SITE, 'index.html'));
  }
}
