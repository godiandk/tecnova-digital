import { Controller, Get, Param, Query } from '@nestjs/common';
import { TournamentsService } from './tournaments.service';

@Controller('torneios')
export class TournamentsController {
  constructor(private readonly tournaments: TournamentsService) {}

  @Get()
  list() {
    return this.tournaments.listTournaments();
  }

  @Get(':id/ranking')
  leaderboard(@Param('id') id: string, @Query('userId') userId?: string) {
    return this.tournaments.leaderboard(id, userId);
  }
}
