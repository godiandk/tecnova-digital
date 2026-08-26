import { Module } from '@nestjs/common';
import { CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';
import { WalletModule } from '../wallet/wallet.module';
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [WalletModule, RolesModule],
  controllers: [CouponsController],
  providers: [CouponsService],
})
export class CouponsModule {}
