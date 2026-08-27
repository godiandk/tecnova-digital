import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { WalletService } from '../wallet/wallet.service';
import { DatabaseService } from '../../database/database.service';

export interface ChipPackage {
  id: string;
  chips: number;
  priceLabel: string;
  bonusLabel?: string;
}

@Injectable()
export class StoreService {
  private readonly logger = new Logger(StoreService.name);

  private readonly packages: ChipPackage[] = [
    { id: 'bronze', chips: 5000, priceLabel: 'R$ 9,90' },
    { id: 'prata', chips: 15000, priceLabel: 'R$ 24,90', bonusLabel: '+10% bônus' },
    { id: 'ouro', chips: 40000, priceLabel: 'R$ 59,90', bonusLabel: '+25% bônus' },
    { id: 'diamante', chips: 120000, priceLabel: 'R$ 149,90', bonusLabel: '+50% bônus' },
  ];

  constructor(
    private readonly walletService: WalletService,
    private readonly db: DatabaseService,
  ) {}

  listPackages(): ChipPackage[] {
    return this.packages;
  }

  /**
   * Credita as fichas de um pacote. É o passo que acontece DEPOIS de alguém confirmar
   * que o dinheiro entrou — quem tranca essa porta é o store.controller.
   *
   * `providerEventId` é o id do evento no provedor de pagamento. Quando ele vem, a
   * compra é registrada com esse id como chave primária: se o provedor reenviar o
   * mesmo evento (o que é normal quando ele não recebe o 200), a segunda chamada não
   * credita nada e devolve a mesma resposta. Sem isso, uma reentrega dobraria as
   * fichas de alguém que pagou uma vez só.
   */
  async fulfillPurchase(userId: string, packageId: string, providerEventId?: string) {
    const chipPackage = this.packages.find((item) => item.id === packageId);
    if (!chipPackage) {
      throw new NotFoundException('Pacote de fichas não encontrado.');
    }

    if (providerEventId) {
      const creditou = await this.db.transaction(async (client) => {
        const { rowCount } = await client.query(
          `INSERT INTO purchases (provider_event_id, user_id, package_id, chips)
           VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
          [providerEventId, userId, packageId, chipPackage.chips],
        );
        if (rowCount === 0) return false; // evento repetido: não credita de novo
        await this.walletService.creditInTransaction(client, userId, chipPackage.chips, 'compra', packageId);
        return true;
      });

      return {
        package: chipPackage,
        repetido: !creditou,
        newBalance: await this.walletService.balanceOf(userId),
      };
    }

    const ledgerEntry = await this.walletService.credit(userId, chipPackage.chips, 'compra', packageId);
    return { package: chipPackage, ledgerEntry, newBalance: await this.walletService.balanceOf(userId) };
  }

  /**
   * A compra foi estornada.
   *
   * As fichas NÃO são retiradas automaticamente, e isso é decisão, não esquecimento: a
   * pessoa pode já ter apostado tudo, e forçar o débito deixaria a carteira negativa —
   * que é um estado que o ledger não deveria conhecer. Fica marcado aqui pra o suporte
   * ver, decidir e agir (tem rota de conceder e a de banir).
   *
   * Marcar em vez de agir sozinho também protege o caso legítimo: cobrança duplicada
   * pelo próprio provedor, compra que a criança fez no cartão do pai. Nem todo estorno
   * é fraude.
   */
  async registrarEstorno(providerEventId: string, userId: string) {
    const linha = await this.db.queryOne<{ package_id: string; chips: number }>(
      `UPDATE purchases SET refunded_at = now()
        WHERE provider_event_id = $1 AND refunded_at IS NULL
        RETURNING package_id, chips`,
      [providerEventId],
    );

    if (!linha) {
      // Estorno de uma compra que a gente não conhece, ou já marcada. Não é erro:
      // responder 200 evita o provedor reenviar pra sempre.
      return { estorno: true, jaRegistrado: true };
    }

    this.logger.warn(
      `Estorno registrado: usuário ${userId}, pacote ${linha.package_id} (${linha.chips} fichas). ` +
        'As fichas NÃO foram retiradas — precisa de decisão do suporte.',
    );
    return { estorno: true, userId, packageId: linha.package_id, chips: linha.chips };
  }
}
