import { Controller, Get, Post } from '@nestjs/common';
import { RecompensasService } from './recompensas.service';
import { UsuarioAtual } from '../auth/usuario-atual.decorator';

@Controller('recompensas')
export class RecompensasController {
  constructor(private readonly recompensas: RecompensasService) {}

  /** O calendário desta pessoa, com o valor de cada um dos trinta dias. */
  @Get('diaria')
  calendario(@UsuarioAtual() userId: string) {
    return this.recompensas.calendarioDe(userId);
  }

  @Post('diaria/coletar')
  coletar(@UsuarioAtual() userId: string) {
    return this.recompensas.coletar(userId);
  }
}
