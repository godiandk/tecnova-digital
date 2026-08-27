import { Module } from '@nestjs/common';
import { SlotsController } from './slots.controller';
import { SlotsService } from './slots.service';
import { WalletModule } from '../../wallet/wallet.module';
import { TournamentsModule } from '../../tournaments/tournaments.module';

@Module({
  imports: [WalletModule, TournamentsModule],
  controllers: [SlotsController],
  providers: [SlotsService],
})
export class SlotsModule {}
