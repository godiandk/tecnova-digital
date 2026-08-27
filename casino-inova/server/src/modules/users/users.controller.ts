import { Controller, Get } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsuarioAtual } from '../auth/usuario-atual.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** Quem está logado. Sai do token, não de um id fixo no código. */
  @Get('me')
  getMe(@UsuarioAtual() userId: string) {
    return this.usersService.findById(userId);
  }
}
