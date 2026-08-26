import { Module } from '@nestjs/common';
import { TrucoController } from './truco.controller';
import { TrucoService } from './truco.service';
import { WalletModule } from '../../wallet/wallet.module';

@Module({
  imports: [WalletModule],
  controllers: [TrucoController],
  providers: [TrucoService],
})
export class TrucoModule {}
