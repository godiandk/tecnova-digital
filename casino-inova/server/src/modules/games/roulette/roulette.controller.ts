import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { RouletteService } from './roulette.service';
import { ApostaComValor } from './roulette.engine';
import { UsuarioAtual } from '../../auth/usuario-atual.decorator';
import { Publico } from '../../auth/auth.guard';
import { AcaoDto } from '../shared/acao.dto';

class SpinDto extends AcaoDto {
  /**
   * As apostas da rodada, cada uma com o valor dela.
   *
   * Era uma aposta só (`bet` mais `amount`), e isso não é roleta: na mesa se põe ficha
   * em quantas casas quiser antes de a bola correr. Com uma aposta por rodada, "uma
   * ficha no 17 e uma no vermelho" precisava de dois giros — dois resultados
   * diferentes pra uma jogada que na mesa é uma só.
   */
  bets!: ApostaComValor[];
}

@Controller('games/roleta')
export class RouletteController {
  constructor(private readonly rouletteService: RouletteService) {}

  @Publico()
  @Get('historico')
  getHistory() {
    return this.rouletteService.getHistory();
  }

  @Publico()
  @Get('config')
  getConfig() {
    return this.rouletteService.getConfig();
  }

  @Post('girar')
  spin(@UsuarioAtual() usuarioLogado: string, @Body() body: SpinDto) {
    if (!Array.isArray(body?.bets) || body.bets.length === 0) {
      throw new BadRequestException('Informe bets: a lista de apostas da rodada.');
    }
    if (body.bets.some((a) => !a || typeof a.type !== 'string' || typeof a.amount !== 'number')) {
      throw new BadRequestException('Cada aposta precisa de type e amount.');
    }
    return this.rouletteService.playSpin(usuarioLogado, body.bets, body.actionId);
  }
}
