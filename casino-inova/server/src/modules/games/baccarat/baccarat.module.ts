import { Module } from '@nestjs/common';
import { BaccaratController } from './baccarat.controller';
import { BaccaratService } from './baccarat.service';
import { WalletModule } from '../../wallet/wallet.module';
import { RoadmapModule } from '../../roadmap/roadmap.module';

@Module({
  imports: [WalletModule, RoadmapModule],
  controllers: [BaccaratController],
  providers: [BaccaratService],
})
export class BaccaratModule {}
