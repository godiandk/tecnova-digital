import { Module } from '@nestjs/common';
import { RoomsGateway } from './rooms.gateway';
import { BancaFrancesaTableService } from './banca-francesa-table.service';
import { TrucoTableService } from './truco-table.service';
import { DominoTableService } from './domino-table.service';
import { WalletModule } from '../wallet/wallet.module';
import { UsersModule } from '../users/users.module';
import { FriendsModule } from '../friends/friends.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [WalletModule, UsersModule, FriendsModule, ChatModule],
  providers: [RoomsGateway, BancaFrancesaTableService, TrucoTableService, DominoTableService],
})
export class RoomsModule {}
