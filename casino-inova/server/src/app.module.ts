import { Module } from '@nestjs/common';
import { UsersModule } from './modules/users/users.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { StoreModule } from './modules/store/store.module';
import { SlotsModule } from './modules/games/slots/slots.module';

@Module({
  imports: [UsersModule, WalletModule, StoreModule, SlotsModule],
})
export class AppModule {}
