import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { SlotsService } from './slots.service';
import { UsuarioAtual } from '../../auth/usuario-atual.decorator';
import { Publico } from '../../auth/auth.guard';
import { AcaoDto } from '../shared/acao.dto';

class SpinDto extends AcaoDto {
  bet!: number;
}

@Controller('games/slots')
export class SlotsController {
  constructor(private readonly slotsService: SlotsService) {}

  @Publico()
  @Get('config')
  getConfig() {
    return this.slotsService.getConfig();
  }

  @Post('girar')
  spin(@UsuarioAtual() usuarioLogado: string, @Body() body: SpinDto) {
    if (typeof body.bet !== 'number') {
      throw new BadRequestException('Informe bet.');
    }
    return this.slotsService.playSpin(usuarioLogado, body.bet, body.actionId);
  }
}
