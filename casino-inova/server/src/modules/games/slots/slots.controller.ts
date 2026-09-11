import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { SlotsService } from './slots.service';
import { UsuarioAtual } from '../../auth/usuario-atual.decorator';
import { AcaoDto } from '../shared/acao.dto';

class SpinDto extends AcaoDto {
  bet!: number;
}

@Controller('games/slots')
export class SlotsController {
  constructor(private readonly slotsService: SlotsService) {}

  /*
   * DEIXOU DE SER PÚBLICO: a faixa de aposta é do degrau de quem pergunta, e degrau
   * depende de saldo e nível — dois dados que só existem com alguém identificado.
   */
  @Get('config')
  getConfig(@UsuarioAtual() usuarioLogado: string) {
    return this.slotsService.getConfig(usuarioLogado);
  }

  @Post('girar')
  spin(@UsuarioAtual() usuarioLogado: string, @Body() body: SpinDto) {
    if (typeof body.bet !== 'number') {
      throw new BadRequestException('Informe bet.');
    }
    return this.slotsService.playSpin(usuarioLogado, body.bet, body.actionId);
  }
}
