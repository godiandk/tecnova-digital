import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { RolesService } from './roles.service';
import { Role } from './roles.constants';

class AssignRoleDto {
  actingUserId!: string;
  targetUserId!: string;
  role!: Role;
}

class GrantSupportChipsDto {
  actingUserId!: string;
  targetUserId!: string;
  chips!: number;
  reason?: string;
}

/**
 * Sem autenticação real ainda, `actingUserId` viaja explícito em cada chamada — é
 * quem a rota confere ter permissão antes de agir. Quando o login existir, isso vira
 * o usuário do token, não um campo que o cliente escolhe.
 */
@Controller('admin')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('papeis/permissoes')
  getPermissionMatrix() {
    return this.rolesService.getPermissionMatrix();
  }

  @Get('usuarios')
  listUsers(@Query('actingUserId') actingUserId: string) {
    if (!actingUserId) {
      throw new BadRequestException('Informe actingUserId.');
    }
    return this.rolesService.listUsers(actingUserId);
  }

  @Post('papeis/atribuir')
  assignRole(@Body() body: AssignRoleDto) {
    if (!body?.actingUserId || !body?.targetUserId || !body?.role) {
      throw new BadRequestException('Informe actingUserId, targetUserId e role.');
    }
    return this.rolesService.assignRole(body.actingUserId, body.targetUserId, body.role);
  }

  @Post('suporte/conceder-fichas')
  grantSupportChips(@Body() body: GrantSupportChipsDto) {
    if (!body?.actingUserId || !body?.targetUserId || typeof body.chips !== 'number') {
      throw new BadRequestException('Informe actingUserId, targetUserId e chips.');
    }
    return this.rolesService.grantSupportChips(body.actingUserId, body.targetUserId, body.chips, body.reason ?? '');
  }
}
