import { Module } from '@nestjs/common';
import { BancaFrancesaController } from './banca-francesa.controller';
import { BancaFrancesaService } from './banca-francesa.service';
import { WalletModule } from '../../wallet/wallet.module';
import { RoadmapModule } from '../../roadmap/roadmap.module';
import { TournamentsModule } from '../../tournaments/tournaments.module';

@Module({
  imports: [WalletModule, RoadmapModule, TournamentsModule],
  controllers: [BancaFrancesaController],
  providers: [BancaFrancesaService],
})
export class BancaFrancesaModule {}
