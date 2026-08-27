import { Module } from '@nestjs/common';
import { RoomsGateway } from './rooms.gateway';
import { BancaFrancesaTableService } from './banca-francesa-table.service';
import { WalletModule } from '../wallet/wallet.module';
import { UsersModule } from '../users/users.module';
import { FriendsModule } from '../friends/friends.module';

@Module({
  imports: [WalletModule, UsersModule, FriendsModule],
  providers: [RoomsGateway, BancaFrancesaTableService],
})
export class RoomsModule {}
