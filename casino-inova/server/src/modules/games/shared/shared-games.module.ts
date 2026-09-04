import { Global, Module } from '@nestjs/common';
import { AcoesRepetidas } from './acoes-repetidas.service';
import { NiveisController } from './niveis.controller';
import { WalletModule } from '../../wallet/wallet.module';

/**
 * Global porque os dez jogos precisam do MESMO registro de ações — uma instância por
 * módulo faria cada jogo ter a sua memória e a deduplicação valeria só dentro de um.
 */
@Global()
@Module({
  /*
   * A carteira entra explicitamente: ser `@Global()` exporta o que ESTE módulo provê,
   * não importa pra dentro dele o que os outros provêem. Sem esta linha o Nest sobe e
   * quebra na primeira chamada, com "can't resolve WalletService" — erro de execução,
   * que o compilador não pega.
   */
  imports: [WalletModule],
  controllers: [NiveisController],
  providers: [AcoesRepetidas],
  exports: [AcoesRepetidas],
})
export class SharedGamesModule {}
