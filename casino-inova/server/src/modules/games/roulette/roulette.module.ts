import { Module } from '@nestjs/common';
import { RouletteController } from './roulette.controller';
import { RouletteService } from './roulette.service';
import { WalletModule } from '../../wallet/wallet.module';
import { TournamentsModule } from '../../tournaments/tournaments.module';

@Module({
  imports: [WalletModule, TournamentsModule],
  controllers: [RouletteController],
  providers: [RouletteService],
})
export class RouletteModule {}
