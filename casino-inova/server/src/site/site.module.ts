import { Module } from '@nestjs/common';
import { SiteController } from './site.controller';
import { VersaoController } from './versao.controller';
import { SITE_PUBLICADO } from './pasta-do-site';

/**
 * Só registra o curinga quando existe site publicado. Em desenvolvimento a pasta não
 * existe (quem serve o app é o Metro na 8081), e aí o servidor continua respondendo
 * 404 de verdade pra rota errada — que é o que ajuda a achar erro de digitação.
 */
/*
 * A ORDEM AQUI IMPORTA: VersaoController antes do SiteController.
 *
 * O SiteController é um curinga `@Get('*')`. Registrado antes, ele engoliria /versao e
 * devolveria o index.html — o aplicativo receberia HTML onde espera JSON e concluiria,
 * a cada checagem, que a versão mudou. Reiniciaria pra sempre, sozinho.
 */
@Module({
  controllers: SITE_PUBLICADO ? [VersaoController, SiteController] : [VersaoController],
})
export class SiteModule {}
