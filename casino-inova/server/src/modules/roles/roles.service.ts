import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { WalletService } from '../wallet/wallet.service';
import { MODERATOR_SUPPORT_CHIPS_CAP, Permission, Role, ROLE_PERMISSIONS } from './roles.constants';

@Injectable()
export class RolesService {
  constructor(
    private readonly usersService: UsersService,
    private readonly walletService: WalletService,
  ) {}

  hasPermission(role: Role, permission: Permission): boolean {
    return ROLE_PERMISSIONS[role].includes(permission);
  }

  /** Lança 403 se `actingUserId` não existir ou não tiver a permissão — usar no início de toda ação administrativa. */
  requirePermission(actingUserId: string, permission: Permission): void {
    const actingUser = this.usersService.findById(actingUserId);
    if (!actingUser || !this.hasPermission(actingUser.role, permission)) {
      throw new ForbiddenException(`Essa ação exige a permissão "${permission}".`);
    }
  }

  getPermissionMatrix() {
    return ROLE_PERMISSIONS;
  }

  listUsers(actingUserId: string) {
    this.requirePermission(actingUserId, 'gerenciar_papeis');
    return this.usersService.list();
  }

  /**
   * Nunca promove ninguém a admin por aqui — só troca entre jogador e moderador.
   * Virar admin é uma decisão que fica fora da API, feita direto na base de dados,
   * de propósito (é o único jeito de garantir que um moderador nunca se auto-promove
   * a admin nem promove outra pessoa a admin).
   */
  assignRole(actingUserId: string, targetUserId: string, role: Role): ReturnType<UsersService['updateRole']> {
    this.requirePermission(actingUserId, 'gerenciar_papeis');
    if (role === 'admin') {
      throw new ForbiddenException('Promover a admin não é permitido por esta rota — faça isso direto na base de dados.');
    }
    return this.usersService.updateRole(targetUserId, role);
  }

  grantSupportChips(actingUserId: string, targetUserId: string, chips: number, reason: string) {
    this.requirePermission(actingUserId, 'conceder_fichas_suporte');
    if (!Number.isFinite(chips) || chips <= 0) {
      throw new BadRequestException('chips precisa ser maior que zero.');
    }

    const actingUser = this.usersService.findById(actingUserId)!;
    if (actingUser.role === 'moderador' && chips > MODERATOR_SUPPORT_CHIPS_CAP) {
      throw new ForbiddenException(`Moderadores só podem conceder até ${MODERATOR_SUPPORT_CHIPS_CAP} fichas por vez.`);
    }

    const ledgerEntry = this.walletService.credit(targetUserId, chips, 'suporte');
    return { targetUserId, chips, reason, ledgerEntry, newBalance: this.walletService.balanceOf(targetUserId) };
  }
}
