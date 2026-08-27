import { Module } from '@nestjs/common';
import { BacBoController } from './bac-bo.controller';
import { BacBoService } from './bac-bo.service';
import { WalletModule } from '../../wallet/wallet.module';
import { RoadmapModule } from '../../roadmap/roadmap.module';
import { TournamentsModule } from '../../tournaments/tournaments.module';

@Module({
  imports: [WalletModule, RoadmapModule, TournamentsModule],
  controllers: [BacBoController],
  providers: [BacBoService],
  exports: [BacBoService],
})
export class BacBoModule {}
