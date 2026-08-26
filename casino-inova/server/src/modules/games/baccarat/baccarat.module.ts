import { Module } from '@nestjs/common';
import { BaccaratController } from './baccarat.controller';
import { BaccaratService } from './baccarat.service';
import { WalletModule } from '../../wallet/wallet.module';

@Module({
  imports: [WalletModule],
  controllers: [BaccaratController],
  providers: [BaccaratService],
})
export class BaccaratModule {}
