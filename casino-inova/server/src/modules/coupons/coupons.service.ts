import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { WalletService } from '../wallet/wallet.service';
import { RolesService } from '../roles/roles.service';

interface Coupon {
  code: string;
  chips: number;
  maxRedemptions: number;
  redeemedBy: Set<string>;
  active: boolean;
}

@Injectable()
export class CouponsService {
  private readonly coupons = new Map<string, Coupon>();

  constructor(
    private readonly walletService: WalletService,
    private readonly rolesService: RolesService,
  ) {}

  create(actingUserId: string, code: string, chips: number, maxRedemptions: number) {
    this.rolesService.requirePermission(actingUserId, 'gerenciar_cupons');

    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) {
      throw new BadRequestException('O código do cupom não pode ser vazio.');
    }
    if (this.coupons.has(normalizedCode)) {
      throw new BadRequestException('Já existe um cupom com esse código.');
    }
    if (!Number.isFinite(chips) || chips <= 0) {
      throw new BadRequestException('chips precisa ser maior que zero.');
    }
    if (!Number.isInteger(maxRedemptions) || maxRedemptions <= 0) {
      throw new BadRequestException('maxRedemptions precisa ser um número inteiro maior que zero.');
    }

    const coupon: Coupon = { code: normalizedCode, chips, maxRedemptions, redeemedBy: new Set(), active: true };
    this.coupons.set(normalizedCode, coupon);
    return this.toPublic(coupon);
  }

  list(actingUserId: string) {
    this.rolesService.requirePermission(actingUserId, 'gerenciar_cupons');
    return Array.from(this.coupons.values()).map((coupon) => this.toPublic(coupon));
  }

  deactivate(actingUserId: string, code: string) {
    this.rolesService.requirePermission(actingUserId, 'gerenciar_cupons');
    const coupon = this.findOrThrow(code);
    coupon.active = false;
    return this.toPublic(coupon);
  }

  redeem(userId: string, code: string) {
    const coupon = this.findOrThrow(code);
    if (!coupon.active) {
      throw new BadRequestException('Esse cupom não está mais ativo.');
    }
    if (coupon.redeemedBy.has(userId)) {
      throw new BadRequestException('Você já resgatou esse cupom.');
    }
    if (coupon.redeemedBy.size >= coupon.maxRedemptions) {
      throw new BadRequestException('Esse cupom já atingiu o limite de resgates.');
    }

    coupon.redeemedBy.add(userId);
    const ledgerEntry = this.walletService.credit(userId, coupon.chips, 'cupom');
    return { code: coupon.code, chips: coupon.chips, ledgerEntry, newBalance: this.walletService.balanceOf(userId) };
  }

  private findOrThrow(code: string): Coupon {
    const coupon = this.coupons.get(code.trim().toUpperCase());
    if (!coupon) {
      throw new NotFoundException('Cupom não encontrado.');
    }
    return coupon;
  }

  private toPublic(coupon: Coupon) {
    return {
      code: coupon.code,
      chips: coupon.chips,
      maxRedemptions: coupon.maxRedemptions,
      redemptions: coupon.redeemedBy.size,
      active: coupon.active,
    };
  }
}
