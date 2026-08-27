import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { WalletService } from '../wallet/wallet.service';
import { RolesService } from '../roles/roles.service';
import { DatabaseService } from '../../database/database.service';

interface LinhaCupom {
  code: string;
  chips: number;
  max_redemptions: number;
  active: boolean;
  resgates: number;
}

@Injectable()
export class CouponsService {
  constructor(
    private readonly walletService: WalletService,
    private readonly rolesService: RolesService,
    private readonly db: DatabaseService,
  ) {}

  async create(actingUserId: string, code: string, chips: number, maxRedemptions: number) {
    await this.rolesService.requirePermission(actingUserId, 'gerenciar_cupons');

    const normalizado = code.trim().toUpperCase();
    if (!normalizado) {
      throw new BadRequestException('O código do cupom não pode ser vazio.');
    }
    if (!Number.isFinite(chips) || chips <= 0) {
      throw new BadRequestException('chips precisa ser maior que zero.');
    }
    if (!Number.isInteger(maxRedemptions) || maxRedemptions <= 0) {
      throw new BadRequestException('maxRedemptions precisa ser um número inteiro maior que zero.');
    }

    const jaExiste = await this.db.queryOne('SELECT code FROM coupons WHERE code = $1', [normalizado]);
    if (jaExiste) {
      throw new BadRequestException('Já existe um cupom com esse código.');
    }

    await this.db.query('INSERT INTO coupons (code, chips, max_redemptions) VALUES ($1,$2,$3)', [
      normalizado,
      Math.round(chips),
      maxRedemptions,
    ]);
    return this.buscarPublico(normalizado);
  }

  async list(actingUserId: string) {
    await this.rolesService.requirePermission(actingUserId, 'gerenciar_cupons');
    const linhas = await this.db.query<LinhaCupom>(`${SELECT_COM_RESGATES} ORDER BY c.created_at`);
    return linhas.map(paraPublico);
  }

  async deactivate(actingUserId: string, code: string) {
    await this.rolesService.requirePermission(actingUserId, 'gerenciar_cupons');
    const normalizado = code.trim().toUpperCase();
    const linha = await this.db.queryOne('UPDATE coupons SET active = FALSE WHERE code = $1 RETURNING code', [
      normalizado,
    ]);
    if (!linha) {
      throw new NotFoundException('Cupom não encontrado.');
    }
    return this.buscarPublico(normalizado);
  }

  /**
   * Resgatar é uma ação de jogador comum — não exige permissão nenhuma.
   *
   * As três checagens (ativo, ainda não resgatado por você, limite não estourado)
   * acontecem dentro de uma transação que trava a linha do cupom. Sem isso, duas
   * pessoas resgatando o último resgate ao mesmo tempo passariam as duas. A chave
   * primária de coupon_redemptions é a segunda linha de defesa contra resgate duplo
   * da mesma pessoa: mesmo que a checagem falhasse, o banco recusaria.
   */
  async redeem(userId: string, code: string) {
    const normalizado = code.trim().toUpperCase();

    const cupom = await this.db.transaction(async (client) => {
      const { rows } = await client.query<{ code: string; chips: number; max_redemptions: number; active: boolean }>(
        'SELECT * FROM coupons WHERE code = $1 FOR UPDATE',
        [normalizado],
      );
      const encontrado = rows[0];
      if (!encontrado) {
        throw new NotFoundException('Cupom não encontrado.');
      }
      if (!encontrado.active) {
        throw new BadRequestException('Esse cupom não está mais ativo.');
      }

      const { rows: jaResgatou } = await client.query(
        'SELECT 1 FROM coupon_redemptions WHERE coupon_code = $1 AND user_id = $2',
        [normalizado, userId],
      );
      if (jaResgatou.length > 0) {
        throw new BadRequestException('Você já resgatou esse cupom.');
      }

      const { rows: total } = await client.query<{ total: number }>(
        'SELECT COUNT(*)::int AS total FROM coupon_redemptions WHERE coupon_code = $1',
        [normalizado],
      );
      if ((total[0]?.total ?? 0) >= encontrado.max_redemptions) {
        throw new BadRequestException('Esse cupom já atingiu o limite de resgates.');
      }

      await client.query('INSERT INTO coupon_redemptions (coupon_code, user_id) VALUES ($1,$2)', [
        normalizado,
        userId,
      ]);
      // Crédito na mesma transação: ou a pessoa fica marcada como tendo resgatado E
      // recebe a ficha, ou nenhuma das duas coisas acontece.
      await this.walletService.creditInTransaction(client, userId, encontrado.chips, 'cupom', normalizado);
      return encontrado;
    });

    return {
      code: cupom.code,
      chips: cupom.chips,
      ledgerEntry: undefined,
      newBalance: await this.walletService.balanceOf(userId),
    };
  }

  private async buscarPublico(code: string) {
    const linha = await this.db.queryOne<LinhaCupom>(`${SELECT_COM_RESGATES} WHERE c.code = $1`, [code]);
    if (!linha) {
      throw new NotFoundException('Cupom não encontrado.');
    }
    return paraPublico(linha);
  }
}

const SELECT_COM_RESGATES = `
  SELECT c.*, (SELECT COUNT(*)::int FROM coupon_redemptions r WHERE r.coupon_code = c.code) AS resgates
    FROM coupons c`;

function paraPublico(linha: LinhaCupom) {
  return {
    code: linha.code,
    chips: linha.chips,
    maxRedemptions: linha.max_redemptions,
    redemptions: linha.resgates,
    active: linha.active,
  };
}
