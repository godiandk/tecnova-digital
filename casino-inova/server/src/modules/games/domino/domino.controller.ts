import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { DominoService } from './domino.service';
import { BoardEnd } from './domino.engine';
import { Tile } from './domino.config';

class NewMatchDto {
  userId!: string;
  buyIn!: number;
}

class PlayTileDto {
  userId!: string;
  tile!: Tile;
  end?: BoardEnd;
}

class UserIdDto {
  userId!: string;
}

@Controller('games/domino')
export class DominoController {
  constructor(private readonly dominoService: DominoService) {}

  @Get('config')
  getConfig() {
    return this.dominoService.getConfig();
  }

  @Post('nova-partida')
  newMatch(@Body() body: NewMatchDto) {
    if (!body?.userId || typeof body.buyIn !== 'number') {
      throw new BadRequestException('Informe userId e buyIn.');
    }
    return this.dominoService.newMatch(body.userId, body.buyIn);
  }

  @Post('jogar-peca')
  playTile(@Body() body: PlayTileDto) {
    if (!body?.userId || !body?.tile) {
      throw new BadRequestException('Informe userId e tile.');
    }
    return this.dominoService.playTile(body.userId, body.tile, body.end);
  }

  @Post('passar')
  passTurn(@Body() body: UserIdDto) {
    if (!body?.userId) {
      throw new BadRequestException('Informe userId.');
    }
    return this.dominoService.passTurn(body.userId);
  }
}
