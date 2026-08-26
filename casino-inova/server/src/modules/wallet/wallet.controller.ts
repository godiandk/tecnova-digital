import { Controller, Get, Param } from '@nestjs/common';
import { WalletService } from './wallet.service';

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get(':userId/saldo')
  getBalance(@Param('userId') userId: string) {
    return { userId, balance: this.walletService.balanceOf(userId) };
  }

  @Get(':userId/historico')
  getHistory(@Param('userId') userId: string) {
    return this.walletService.historyOf(userId);
  }
}
