import { Module } from '@nestjs/common';
import { StoreController } from './store.controller';
import { StoreService } from './store.service';
import { Promocoes } from './promocoes';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [WalletModule],
  controllers: [StoreController],
  providers: [StoreService, Promocoes],
})
export class StoreModule {}
