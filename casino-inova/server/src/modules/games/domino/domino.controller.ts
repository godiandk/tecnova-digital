import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { DominoService } from './domino.service';
import { BoardEnd } from './domino.engine';
import { Tile } from './domino.config';
import { UsuarioAtual } from '../../auth/usuario-atual.decorator';
import { AcaoDto } from '../shared/acao.dto';

class NewMatchDto extends AcaoDto {
  buyIn!: number;
}

class PlayTileDto {
  tile!: Tile;
  end?: BoardEnd;
}

class UserIdDto {
}

@Controller('games/domino')
export class DominoController {
  constructor(private readonly dominoService: DominoService) {}

  /*
   * DEIXOU DE SER PÚBLICO: a faixa de entrada agora é do degrau de quem pergunta, e degrau
   * depende de saldo e nível — dois dados que só existem com alguém identificado.
   */
  /**
   * A partida aberta deste jogador, ou `null`.
   *
   * É o que a tela pede AO ABRIR. Sem esta rota, quem recarregava a página perdia o
   * caminho de volta pra uma partida que continuava viva e com a entrada já debitada.
   */
  @Get('partida')
  partidaAberta(@UsuarioAtual() usuarioLogado: string) {
    return this.dominoService.partidaAberta(usuarioLogado);
  }

  @Get('config')
  getConfig(@UsuarioAtual() usuarioLogado: string) {
    return this.dominoService.getConfig(usuarioLogado);
  }

  @Post('nova-partida')
  newMatch(@UsuarioAtual() usuarioLogado: string, @Body() body: NewMatchDto) {
    if (typeof body.buyIn !== 'number') {
      throw new BadRequestException('Informe buyIn.');
    }
    return this.dominoService.newMatch(usuarioLogado, body.buyIn, body.actionId);
  }

  @Post('jogar-peca')
  playTile(@UsuarioAtual() usuarioLogado: string, @Body() body: PlayTileDto) {
    if (!body?.tile) {
      throw new BadRequestException('Informe tile.');
    }
    return this.dominoService.playTile(usuarioLogado, body.tile, body.end);
  }

  @Post('passar')
  passTurn(@UsuarioAtual() usuarioLogado: string, @Body() body: UserIdDto) {
    return this.dominoService.passTurn(usuarioLogado);
  }
}
