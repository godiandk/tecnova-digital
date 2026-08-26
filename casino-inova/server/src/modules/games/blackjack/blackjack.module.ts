import { Module } from '@nestjs/common';
import { BlackjackController } from './blackjack.controller';
import { BlackjackService } from './blackjack.service';
import { WalletModule } from '../../wallet/wallet.module';

@Module({
  imports: [WalletModule],
  controllers: [BlackjackController],
  providers: [BlackjackService],
})
export class BlackjackModule {}
