import { Module } from '@nestjs/common';
import { UsersModule } from './modules/users/users.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { StoreModule } from './modules/store/store.module';
import { SlotsModule } from './modules/games/slots/slots.module';
import { RouletteModule } from './modules/games/roulette/roulette.module';
import { BlackjackModule } from './modules/games/blackjack/blackjack.module';
import { BaccaratModule } from './modules/games/baccarat/baccarat.module';
import { BancaFrancesaModule } from './modules/games/banca-francesa/banca-francesa.module';
import { RolesModule } from './modules/roles/roles.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { TrucoModule } from './modules/games/truco/truco.module';
import { DominoModule } from './modules/games/domino/domino.module';
import { PokerModule } from './modules/games/poker/poker.module';
import { FriendsModule } from './modules/friends/friends.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { BacBoModule } from './modules/games/bac-bo/bac-bo.module';
import { StockMarketModule } from './modules/games/stock-market/stock-market.module';
import { ChatModule } from './modules/chat/chat.module';
import { RoadmapModule } from './modules/roadmap/roadmap.module';

@Module({
  imports: [
    UsersModule,
    WalletModule,
    StoreModule,
    SlotsModule,
    RouletteModule,
    BlackjackModule,
    BaccaratModule,
    BancaFrancesaModule,
    BacBoModule,
    StockMarketModule,
    ChatModule,
    RoadmapModule,
    RolesModule,
    CouponsModule,
    TrucoModule,
    DominoModule,
    PokerModule,
    FriendsModule,
    RoomsModule,
  ],
})
export class AppModule {}
