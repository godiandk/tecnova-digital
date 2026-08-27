import { Module } from '@nestjs/common';
import { BacBoController } from './bac-bo.controller';
import { BacBoService } from './bac-bo.service';
import { WalletModule } from '../../wallet/wallet.module';

@Module({
  imports: [WalletModule],
  controllers: [BacBoController],
  providers: [BacBoService],
  exports: [BacBoService],
})
export class BacBoModule {}
