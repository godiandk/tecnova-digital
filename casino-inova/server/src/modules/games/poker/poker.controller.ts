import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { PokerService } from './poker.service';
import { PokerAction } from './poker.engine';
import { UsuarioAtual } from '../../auth/usuario-atual.decorator';
import { AcaoDto } from '../shared/acao.dto';

class NewHandDto extends AcaoDto {
  buyIn!: number;
}

class ActDto {
  action!: PokerAction;
}

@Controller('games/poker')
export class PokerController {
  constructor(private readonly pokerService: PokerService) {}

  /*
   * DEIXOU DE SER PÚBLICO: a faixa de entrada e os blinds agora saem do degrau de quem
   * pergunta, e degrau depende de saldo e nível — dois dados que só existem com alguém
   * identificado.
   */
  /**
   * A partida aberta deste jogador, ou `null`.
   *
   * É o que a tela pede AO ABRIR. Sem esta rota, quem recarregava a página perdia o
   * caminho de volta pra uma partida que continuava viva e com a entrada já debitada.
   */
  @Get('partida')
  partidaAberta(@UsuarioAtual() usuarioLogado: string) {
    return this.pokerService.maoAberta(usuarioLogado);
  }

  @Get('config')
  getConfig(@UsuarioAtual() usuarioLogado: string) {
    return this.pokerService.getConfig(usuarioLogado);
  }

  @Post('nova-mao')
  newHand(@UsuarioAtual() usuarioLogado: string, @Body() body: NewHandDto) {
    if (typeof body.buyIn !== 'number') {
      throw new BadRequestException('Informe buyIn.');
    }
    return this.pokerService.newHand(usuarioLogado, body.buyIn, body.actionId);
  }

  @Post('agir')
  act(@UsuarioAtual() usuarioLogado: string, @Body() body: ActDto) {
    if (!body?.action) {
      throw new BadRequestException('Informe action.');
    }
    return this.pokerService.act(usuarioLogado, body.action);
  }
}
