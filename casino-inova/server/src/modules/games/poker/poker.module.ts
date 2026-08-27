import { Module } from '@nestjs/common';
import { PokerController } from './poker.controller';
import { PokerService } from './poker.service';
import { WalletModule } from '../../wallet/wallet.module';
import { TournamentsModule } from '../../tournaments/tournaments.module';

@Module({
  imports: [WalletModule, TournamentsModule],
  controllers: [PokerController],
  providers: [PokerService],
})
export class PokerModule {}
