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
    /*
     * O index.html NÃO PODE FICAR EM CACHE. Ele é o único arquivo do site com nome
     * fixo; todo o resto tem o resumo do conteúdo no nome (AppEntry-a1072ff.js), então
     * uma versão nova tem nome novo e nunca é confundida com a velha.
     *
     * É por isso que o cache do index é o que trava uma atualização: o navegador guarda
     * o HTML de ontem, o HTML de ontem aponta pro pacote de ontem, e o pacote novo — que
     * já está no servidor — nunca chega a ser pedido. A pessoa recarrega, recarrega, e
     * continua vendo a versão antiga sem entender por quê.
     *
     * `no-store` resolve na raiz: o HTML é sempre buscado, sempre pequeno (1 kB), e o
     * pacote pesado continua sendo cacheado pelo nome. Recarregar passa a mostrar a
     * versão nova na hora.
     */
    res.setHeader('Cache-Control', 'no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.sendFile(join(PASTA_DO_SITE, 'index.html'));
  }
}
