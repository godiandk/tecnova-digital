import { Injectable, NotFoundException } from '@nestjs/common';
import { WalletService } from '../wallet/wallet.service';

export interface ChipPackage {
  id: string;
  chips: number;
  priceLabel: string;
  bonusLabel?: string;
}

@Injectable()
export class StoreService {
  private readonly packages: ChipPackage[] = [
    { id: 'bronze', chips: 5000, priceLabel: 'R$ 9,90' },
    { id: 'prata', chips: 15000, priceLabel: 'R$ 24,90', bonusLabel: '+10% bônus' },
    { id: 'ouro', chips: 40000, priceLabel: 'R$ 59,90', bonusLabel: '+25% bônus' },
    { id: 'diamante', chips: 120000, priceLabel: 'R$ 149,90', bonusLabel: '+50% bônus' },
  ];

  constructor(private readonly walletService: WalletService) {}

  listPackages(): ChipPackage[] {
    return this.packages;
  }

  /**
   * Credita as fichas de um pacote. É o passo que acontece DEPOIS de alguém confirmar
   * que o dinheiro entrou — nunca deve ser chamado a partir de um pedido do app sem
   * essa confirmação (ver store.controller.ts, que é onde essa porta é trancada).
   */
  async fulfillPurchase(userId: string, packageId: string) {
    const chipPackage = this.packages.find((item) => item.id === packageId);
    if (!chipPackage) {
      throw new NotFoundException('Pacote de fichas não encontrado.');
    }
    const ledgerEntry = await this.walletService.credit(userId, chipPackage.chips, 'compra', packageId);
    return { package: chipPackage, ledgerEntry, newBalance: await this.walletService.balanceOf(userId) };
  }
}
