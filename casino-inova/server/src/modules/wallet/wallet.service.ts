import { Injectable, BadRequestException } from '@nestjs/common';

export type LedgerEntryType = 'compra' | 'aposta' | 'premio' | 'presente' | 'ajuste' | 'cupom' | 'suporte';

export interface LedgerEntry {
  id: string;
  userId: string;
  type: LedgerEntryType;
  /** Positivo = crédito, negativo = débito. */
  amount: number;
  createdAt: string;
}

/**
 * Ledger append-only em memória: nenhuma entrada é editada ou apagada, só adicionada,
 * e o saldo é sempre a soma de todas as entradas — nunca um campo sobrescrito. É a
 * mesma regra descrita no plano de produto. Troca por PostgreSQL quando a Fase 0 real
 * (com persistência) for implementada.
 */
@Injectable()
export class WalletService {
  private readonly entries: LedgerEntry[] = [
    { id: 'seed-1', userId: 'u1', type: 'ajuste', amount: 12500, createdAt: new Date().toISOString() },
  ];

  balanceOf(userId: string): number {
    return this.entries.filter((entry) => entry.userId === userId).reduce((total, entry) => total + entry.amount, 0);
  }

  historyOf(userId: string): LedgerEntry[] {
    return this.entries.filter((entry) => entry.userId === userId);
  }

  credit(userId: string, amount: number, type: LedgerEntryType): LedgerEntry {
    if (amount <= 0) {
      throw new BadRequestException('O valor de um crédito precisa ser maior que zero.');
    }
    return this.appendEntry(userId, amount, type);
  }

  debit(userId: string, amount: number, type: LedgerEntryType): LedgerEntry {
    if (amount <= 0) {
      throw new BadRequestException('O valor de um débito precisa ser maior que zero.');
    }
    if (this.balanceOf(userId) < amount) {
      throw new BadRequestException('Saldo de fichas insuficiente.');
    }
    return this.appendEntry(userId, -amount, type);
  }

  private appendEntry(userId: string, amount: number, type: LedgerEntryType): LedgerEntry {
    const entry: LedgerEntry = {
      id: `entry-${this.entries.length + 1}`,
      userId,
      type,
      amount,
      createdAt: new Date().toISOString(),
    };
    this.entries.push(entry);
    return entry;
  }
}
