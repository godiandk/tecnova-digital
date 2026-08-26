import { Module } from '@nestjs/common';
import { PokerController } from './poker.controller';
import { PokerService } from './poker.service';
import { WalletModule } from '../../wallet/wallet.module';

@Module({
  imports: [WalletModule],
  controllers: [PokerController],
  providers: [PokerService],
})
export class PokerModule {}
