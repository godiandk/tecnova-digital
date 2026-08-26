import { Module } from '@nestjs/common';
import { UsersModule } from './modules/users/users.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { StoreModule } from './modules/store/store.module';
import { SlotsModule } from './modules/games/slots/slots.module';
import { RouletteModule } from './modules/games/roulette/roulette.module';
import { BlackjackModule } from './modules/games/blackjack/blackjack.module';

@Module({
  imports: [UsersModule, WalletModule, StoreModule, SlotsModule, RouletteModule, BlackjackModule],
})
export class AppModule {}
