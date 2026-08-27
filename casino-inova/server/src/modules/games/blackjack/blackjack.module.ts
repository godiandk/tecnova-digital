import { Module } from '@nestjs/common';
import { BlackjackController } from './blackjack.controller';
import { BlackjackService } from './blackjack.service';
import { WalletModule } from '../../wallet/wallet.module';
import { TournamentsModule } from '../../tournaments/tournaments.module';

@Module({
  imports: [WalletModule, TournamentsModule],
  controllers: [BlackjackController],
  providers: [BlackjackService],
})
export class BlackjackModule {}
