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
   * Simula o que acontece depois que a RevenueCat confirma um recibo de compra real
   * na App Store / Play Store — falta só plugar o webhook de verdade quando a Fase 0
   * ganhar persistência de verdade. Por enquanto credita direto na carteira em memória,
   * o que já deixa o fluxo carteira → loja → carteira testável de ponta a ponta.
   */
  fulfillPurchase(userId: string, packageId: string) {
    const chipPackage = this.packages.find((item) => item.id === packageId);
    if (!chipPackage) {
      throw new NotFoundException('Pacote de fichas não encontrado.');
    }
    const ledgerEntry = this.walletService.credit(userId, chipPackage.chips, 'compra');
    return { package: chipPackage, ledgerEntry, newBalance: this.walletService.balanceOf(userId) };
  }
}
