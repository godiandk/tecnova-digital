import { Controller, Get } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { UsuarioAtual } from '../auth/usuario-atual.decorator';

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  /**
   * O saldo de quem está logado. Antes a rota era `/wallet/:userId/saldo`, o que
   * deixava qualquer um ler o saldo de qualquer pessoa só trocando o id na URL.
   *
   * Ver a carteira de OUTRA pessoa é ação de suporte e mora em `/admin/carteira/...`,
   * atrás da permissão `ver_carteira_usuario`.
   */
  @Get('saldo')
  async getBalance(@UsuarioAtual() userId: string) {
    return { userId, balance: await this.walletService.balanceOf(userId) };
  }

  @Get('historico')
  getHistory(@UsuarioAtual() userId: string) {
    return this.walletService.historyOf(userId);
  }
}
