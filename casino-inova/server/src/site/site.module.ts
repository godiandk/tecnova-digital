import { Module } from '@nestjs/common';
import { SiteController } from './site.controller';
import { SITE_PUBLICADO } from './pasta-do-site';

/**
 * Só registra o curinga quando existe site publicado. Em desenvolvimento a pasta não
 * existe (quem serve o app é o Metro na 8081), e aí o servidor continua respondendo
 * 404 de verdade pra rota errada — que é o que ajuda a achar erro de digitação.
 */
@Module({
  controllers: SITE_PUBLICADO ? [SiteController] : [],
})
export class SiteModule {}
