import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RolesService } from './roles.service';
import { WalletService } from '../wallet/wallet.service';
import { Role } from './roles.constants';
import { UsuarioAtual } from '../auth/usuario-atual.decorator';

class AssignRoleDto {
  targetUserId!: string;
  role!: Role;
}

class GrantSupportChipsDto {
  targetUserId!: string;
  chips!: number;
  reason?: string;
}

/**
 * Rotas administrativas. Quem está agindo sai do token (`@UsuarioAtual`), e cada rota
 * confere a permissão específica antes de fazer qualquer coisa — o cliente não escolhe
 * em nome de quem age.
 */
@Controller('admin')
export class RolesController {
  constructor(
    private readonly rolesService: RolesService,
    private readonly walletService: WalletService,
  ) {}

  /**
   * Ver a carteira de outra pessoa é ação de suporte: é o caso de investigar uma
   * reclamação de "sumiram minhas fichas". Mora aqui, atrás da permissão, e não em
   * `/wallet`, justamente pra não parecer coisa de jogador comum.
   */
  @Get('carteira/:userId/saldo')
  async saldoDe(@UsuarioAtual() actingUserId: string, @Param('userId') userId: string) {
    await this.rolesService.requirePermission(actingUserId, 'ver_carteira_usuario');
    return { userId, balance: await this.walletService.balanceOf(userId) };
  }

  @Get('carteira/:userId/historico')
  async historicoDe(@UsuarioAtual() actingUserId: string, @Param('userId') userId: string) {
    await this.rolesService.requirePermission(actingUserId, 'ver_carteira_usuario');
    return this.walletService.historyOf(userId);
  }

  @Get('papeis/permissoes')
  getPermissionMatrix() {
    return this.rolesService.getPermissionMatrix();
  }

  @Get('usuarios')
  listUsers(@UsuarioAtual() actingUserId: string) {
    return this.rolesService.listUsers(actingUserId);
  }

  @Post('papeis/atribuir')
  assignRole(@UsuarioAtual() usuarioLogado: string, @Body() body: AssignRoleDto) {
    if (!body?.targetUserId || !body?.role) {
      throw new BadRequestException('Informe targetUserId e role.');
    }
    return this.rolesService.assignRole(usuarioLogado, body.targetUserId, body.role);
  }

  @Post('suporte/conceder-fichas')
  grantSupportChips(@UsuarioAtual() usuarioLogado: string, @Body() body: GrantSupportChipsDto) {
    if (!body?.targetUserId || typeof body.chips !== 'number') {
      throw new BadRequestException('Informe targetUserId e chips.');
    }
    return this.rolesService.grantSupportChips(usuarioLogado, body.targetUserId, body.chips, body.reason ?? '');
  }
}
