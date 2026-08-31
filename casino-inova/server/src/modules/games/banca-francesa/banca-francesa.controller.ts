import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { BancaFrancesaService } from './banca-francesa.service';
import { BancaFrancesaBet } from './banca-francesa.engine';
import { UsuarioAtual } from '../../auth/usuario-atual.decorator';
import { Publico } from '../../auth/auth.guard';
import { AcaoDto } from '../shared/acao.dto';

class PlayDto extends AcaoDto {
  bets!: BancaFrancesaBet[];
}

@Controller('games/banca-francesa')
export class BancaFrancesaController {
  constructor(private readonly bancaFrancesaService: BancaFrancesaService) {}

  @Publico()
  @Get('placar')
  getRoadmap() {
    return this.bancaFrancesaService.getRoadmap();
  }

  @Publico()
  @Get('config')
  getConfig() {
    return this.bancaFrancesaService.getConfig();
  }

  @Post('apostar')
  playRound(@UsuarioAtual() usuarioLogado: string, @Body() body: PlayDto) {
    if (!Array.isArray(body?.bets)) {
      throw new BadRequestException('Informe bets.');
    }
    return this.bancaFrancesaService.playRound(usuarioLogado, body.bets, body.actionId);
  }
}
