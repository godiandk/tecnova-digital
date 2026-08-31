import { Global, Module } from '@nestjs/common';
import { AcoesRepetidas } from './acoes-repetidas.service';

/**
 * Global porque os dez jogos precisam do MESMO registro de ações — uma instância por
 * módulo faria cada jogo ter a sua memória e a deduplicação valeria só dentro de um.
 */
@Global()
@Module({
  providers: [AcoesRepetidas],
  exports: [AcoesRepetidas],
})
export class SharedGamesModule {}
