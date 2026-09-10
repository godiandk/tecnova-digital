import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { RolesService } from './roles.service';
import { WalletService } from '../wallet/wallet.service';
import { RodadasRepository } from '../games/core/rodadas.repository';
import { Role } from './roles.constants';
import { UsuarioAtual } from '../auth/usuario-atual.decorator';

class AssignRoleDto {
  targetUserId!: string;
  role!: Role;
}

class GrantSupportChipsDto {
  /** Id OU e-mail de login. Quem pede fichas diz o e-mail; o id ninguém sabe de cabeça. */
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
    private readonly rodadas: RodadasRepository,
  ) {}

  /**
   * A RODADA INTEIRA, POR DENTRO — o que o P0.2 guardou e ninguém conseguia ler.
   *
   * As tabelas `rodadas` e `eventos_da_rodada` existiam desde o P0.2 e não tinham porta
   * nenhuma: pra responder "por que essa pessoa não recebeu?" era preciso abrir o banco
   * na mão. Com o registro (P1) escrevendo o número da rodada em toda linha do pedido, o
   * caminho fecha: a pessoa manda o print com o `X-Pedido`, a linha do registro dá o
   * número da rodada, e esta rota conta a rodada inteira — apostas, sorteio, ações e
   * liquidação, em ordem, com hora.
   *
   * Fica atrás de `ver_carteira_usuario` porque é exatamente a mesma natureza de acesso:
   * olhar o que aconteceu com o dinheiro de outra pessoa.
   */
  @Get('rodadas/:id')
  async rodada(@UsuarioAtual() actingUserId: string, @Param('id') id: string) {
    await this.rolesService.requirePermission(actingUserId, 'ver_carteira_usuario');
    const reconstruida = await this.rodadas.reconstruir(id);
    if (!reconstruida) throw new NotFoundException('Rodada não encontrada.');
    return reconstruida;
  }

  /**
   * As rodadas que abriram e não fecharam.
   *
   * É a lista que não pode crescer. Uma rodada aberta sem resultado significa que o
   * processo morreu no meio — e a máquina foi construída pra que esse seja o pior caso
   * possível (registro antes do débito), justamente pra ele ser VISÍVEL em vez de virar
   * dinheiro movido sem explicação.
   */
  @Get('rodadas-abertas')
  async rodadasAbertas(@UsuarioAtual() actingUserId: string) {
    await this.rolesService.requirePermission(actingUserId, 'ver_carteira_usuario');
    return this.rodadas.abertas();
  }

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

  /**
   * Procura alguém pelo e-mail ou pelo id, já com o saldo. É a primeira coisa que o
   * painel faz — confirmar que a pessoa da tela é mesmo quem se quer creditar.
   */
  @Get('usuarios/procurar')
  procurar(@UsuarioAtual() actingUserId: string, @Query('termo') termo: string) {
    if (!termo?.trim()) throw new BadRequestException('Informe um e-mail ou id.');
    return this.rolesService.procurarUsuario(actingUserId, termo);
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
