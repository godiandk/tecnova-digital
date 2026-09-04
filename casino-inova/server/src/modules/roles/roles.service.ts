import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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
  async requirePermission(actingUserId: string, permission: Permission): Promise<void> {
    const actingUser = await this.usersService.findById(actingUserId);
    if (!actingUser || !this.hasPermission(actingUser.role, permission)) {
      throw new ForbiddenException(`Essa ação exige a permissão "${permission}".`);
    }
  }

  getPermissionMatrix() {
    return ROLE_PERMISSIONS;
  }

  async listUsers(actingUserId: string) {
    await this.requirePermission(actingUserId, 'gerenciar_papeis');
    return this.usersService.list();
  }

  /**
   * Nunca promove ninguém a admin por aqui — só troca entre jogador e moderador.
   * Virar admin é uma decisão que fica fora da API, feita direto na base de dados,
   * de propósito (é o único jeito de garantir que um moderador nunca se auto-promove
   * a admin nem promove outra pessoa a admin).
   */
  async assignRole(actingUserId: string, targetUserId: string, role: Role) {
    await this.requirePermission(actingUserId, 'gerenciar_papeis');
    if (role === 'admin') {
      throw new ForbiddenException('Promover a admin não é permitido por esta rota — faça isso direto na base de dados.');
    }
    return this.usersService.updateRole(targetUserId, role);
  }

  /**
   * Procura uma pessoa pelo e-mail ou pelo id, já com o saldo.
   *
   * Devolve o saldo junto porque quem procura alguém no painel está sempre indo dar ou
   * conferir fichas — separar em duas chamadas só faria a tela mostrar o nome primeiro e
   * o número um segundo depois.
   */
  async procurarUsuario(actingUserId: string, termo: string) {
    await this.requirePermission(actingUserId, 'ver_carteira_usuario');
    const usuario = await this.usersService.findByEmailOrId(termo);
    if (!usuario) throw new NotFoundException('Não achei ninguém com esse e-mail ou id.');
    return {
      usuario,
      emails: await this.usersService.emailsDe(usuario.id),
      balance: await this.walletService.balanceOf(usuario.id),
    };
  }

  /**
   * `alvo` pode ser o id OU o e-mail de login. Aceitar os dois é o que torna o painel
   * usável: quem pede fichas diz o e-mail com que entrou, não um id em base64.
   */
  async grantSupportChips(actingUserId: string, alvo: string, chips: number, reason: string) {
    await this.requirePermission(actingUserId, 'conceder_fichas_suporte');
    if (!Number.isFinite(chips) || chips <= 0) {
      throw new BadRequestException('chips precisa ser maior que zero.');
    }
    if (!Number.isInteger(chips)) {
      throw new BadRequestException('Ficha não se parte — o valor precisa ser inteiro.');
    }

    const destino = await this.usersService.findByEmailOrId(alvo);
    if (!destino) throw new NotFoundException('Não achei ninguém com esse e-mail ou id.');
    const targetUserId = destino.id;

    const actingUser = (await this.usersService.findById(actingUserId))!;
    if (actingUser.role === 'moderador' && chips > MODERATOR_SUPPORT_CHIPS_CAP) {
      throw new ForbiddenException(`Moderadores só podem conceder até ${MODERATOR_SUPPORT_CHIPS_CAP} fichas por vez.`);
    }

    const ledgerEntry = await this.walletService.credit(targetUserId, chips, 'suporte');
    return {
      targetUserId,
      targetName: destino.name,
      chips,
      reason,
      ledgerEntry,
      newBalance: await this.walletService.balanceOf(targetUserId),
    };
  }
}
