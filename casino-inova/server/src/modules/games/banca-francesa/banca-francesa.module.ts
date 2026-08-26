import { Module } from '@nestjs/common';
import { BancaFrancesaController } from './banca-francesa.controller';
import { BancaFrancesaService } from './banca-francesa.service';
import { WalletModule } from '../../wallet/wallet.module';

@Module({
  imports: [WalletModule],
  controllers: [BancaFrancesaController],
  providers: [BancaFrancesaService],
})
export class BancaFrancesaModule {}
