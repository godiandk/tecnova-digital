import { Module } from '@nestjs/common';
import { BancaFrancesaController } from './banca-francesa.controller';
import { BancaFrancesaService } from './banca-francesa.service';
import { WalletModule } from '../../wallet/wallet.module';
import { RoadmapModule } from '../../roadmap/roadmap.module';

@Module({
  imports: [WalletModule, RoadmapModule],
  controllers: [BancaFrancesaController],
  providers: [BancaFrancesaService],
})
export class BancaFrancesaModule {}
