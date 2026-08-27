import { Module } from '@nestjs/common';
import { DominoController } from './domino.controller';
import { DominoService } from './domino.service';
import { WalletModule } from '../../wallet/wallet.module';
import { TournamentsModule } from '../../tournaments/tournaments.module';

@Module({
  imports: [WalletModule, TournamentsModule],
  controllers: [DominoController],
  providers: [DominoService],
})
export class DominoModule {}
