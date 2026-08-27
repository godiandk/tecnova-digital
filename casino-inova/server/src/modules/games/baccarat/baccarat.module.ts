import { Module } from '@nestjs/common';
import { BaccaratController } from './baccarat.controller';
import { BaccaratService } from './baccarat.service';
import { WalletModule } from '../../wallet/wallet.module';
import { RoadmapModule } from '../../roadmap/roadmap.module';
import { TournamentsModule } from '../../tournaments/tournaments.module';

@Module({
  imports: [WalletModule, RoadmapModule, TournamentsModule],
  controllers: [BaccaratController],
  providers: [BaccaratService],
})
export class BaccaratModule {}
