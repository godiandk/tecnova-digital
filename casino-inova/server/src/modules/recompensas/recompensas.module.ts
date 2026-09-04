import { Module } from '@nestjs/common';
import { RecompensasService } from './recompensas.service';
import { RecompensasController } from './recompensas.controller';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [WalletModule],
  providers: [RecompensasService],
  controllers: [RecompensasController],
  exports: [RecompensasService],
})
export class RecompensasModule {}
