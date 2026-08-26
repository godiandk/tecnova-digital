import { Module } from '@nestjs/common';
import { DominoController } from './domino.controller';
import { DominoService } from './domino.service';
import { WalletModule } from '../../wallet/wallet.module';

@Module({
  imports: [WalletModule],
  controllers: [DominoController],
  providers: [DominoService],
})
export class DominoModule {}
