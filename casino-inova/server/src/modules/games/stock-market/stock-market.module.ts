import { Module } from '@nestjs/common';
import { StockMarketController } from './stock-market.controller';
import { StockMarketService } from './stock-market.service';
import { WalletModule } from '../../wallet/wallet.module';
import { TournamentsModule } from '../../tournaments/tournaments.module';

@Module({
  imports: [WalletModule, TournamentsModule],
  controllers: [StockMarketController],
  providers: [StockMarketService],
  exports: [StockMarketService],
})
export class StockMarketModule {}
