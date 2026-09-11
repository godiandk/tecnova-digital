import { Module } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { DevolveRodadasPresas } from './devolve-rodadas-presas.service';

@Module({
  controllers: [WalletController],
  providers: [WalletService, DevolveRodadasPresas],
  exports: [WalletService, DevolveRodadasPresas],
})
export class WalletModule {}
