import { Module } from '@nestjs/common';
import { TrucoController } from './truco.controller';
import { TrucoService } from './truco.service';
import { WalletModule } from '../../wallet/wallet.module';
import { TournamentsModule } from '../../tournaments/tournaments.module';

@Module({
  imports: [WalletModule, TournamentsModule],
  controllers: [TrucoController],
  providers: [TrucoService],
})
export class TrucoModule {}
