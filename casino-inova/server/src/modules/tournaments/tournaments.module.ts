import { Module } from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { TournamentsController } from './tournaments.controller';
import { UsersModule } from '../users/users.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [UsersModule, WalletModule],
  providers: [TournamentsService],
  controllers: [TournamentsController],
  exports: [TournamentsService],
})
export class TournamentsModule {}
