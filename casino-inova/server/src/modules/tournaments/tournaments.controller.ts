import { Controller, Get, Param } from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { UsuarioAtual } from '../auth/usuario-atual.decorator';
import { Publico } from '../auth/auth.guard';

@Controller('torneios')
export class TournamentsController {
  constructor(private readonly tournaments: TournamentsService) {}

  /** A lista de torneios e as regras de cada um são públicas — dá pra ver sem conta. */
  @Publico()
  @Get()
  list() {
    return this.tournaments.listTournaments();
  }

  @Get(':id/ranking')
  leaderboard(@UsuarioAtual() userId: string, @Param('id') id: string) {
    return this.tournaments.leaderboard(id, userId);
  }
}
