import { BadRequestException, Body, Controller, Get, Patch } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsuarioAtual } from '../auth/usuario-atual.decorator';
import { AVATARES, avatarExiste } from './avatares';

class AtualizarPerfilDto {
  name?: string;
  avatar?: string;
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** Quem está logado. Sai do token, não de um id fixo no código. */
  @Get('me')
  getMe(@UsuarioAtual() userId: string) {
    return this.usersService.findById(userId);
  }

  /** Os retratos que dá pra escolher. Vem do servidor pra a tela não ter uma lista própria. */
  @Get('avatares')
  listarAvatares() {
    return AVATARES;
  }

  /**
   * Muda o apelido e o retrato de quem está logado.
   *
   * O alvo é sempre o dono do token — não existe parâmetro de "quem" nesta rota, de
   * propósito. Perfil de outra pessoa se mexe pelo painel de admin, atrás de permissão.
   */
  @Patch('me')
  atualizarMe(@UsuarioAtual() userId: string, @Body() body: AtualizarPerfilDto) {
    if (body?.avatar !== undefined && !avatarExiste(body.avatar)) {
      throw new BadRequestException('Esse retrato não existe.');
    }
    if (body?.name === undefined && body?.avatar === undefined) {
      throw new BadRequestException('Informe um apelido ou um retrato.');
    }
    return this.usersService.atualizarPerfil(userId, { name: body.name, avatar: body.avatar });
  }
}
