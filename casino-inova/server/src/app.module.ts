import { Module } from '@nestjs/common';
import { UsersModule } from './modules/users/users.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { StoreModule } from './modules/store/store.module';

@Module({
  imports: [UsersModule, WalletModule, StoreModule],
})
export class AppModule {}
