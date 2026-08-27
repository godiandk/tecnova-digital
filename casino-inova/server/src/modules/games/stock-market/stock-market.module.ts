import { Module } from '@nestjs/common';
import { StockMarketController } from './stock-market.controller';
import { StockMarketService } from './stock-market.service';
import { WalletModule } from '../../wallet/wallet.module';

@Module({
  imports: [WalletModule],
  controllers: [StockMarketController],
  providers: [StockMarketService],
  exports: [StockMarketService],
})
export class StockMarketModule {}
