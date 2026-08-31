import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { DominoService } from './domino.service';
import { BoardEnd } from './domino.engine';
import { Tile } from './domino.config';
import { UsuarioAtual } from '../../auth/usuario-atual.decorator';
import { Publico } from '../../auth/auth.guard';
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

  @Publico()
  @Get('config')
  getConfig() {
    return this.dominoService.getConfig();
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
