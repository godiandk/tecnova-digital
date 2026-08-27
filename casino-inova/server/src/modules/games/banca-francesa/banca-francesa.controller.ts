import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { BancaFrancesaService } from './banca-francesa.service';
import { BancaFrancesaBet } from './banca-francesa.engine';

class PlayDto {
  userId!: string;
  bets!: BancaFrancesaBet[];
}

@Controller('games/banca-francesa')
export class BancaFrancesaController {
  constructor(private readonly bancaFrancesaService: BancaFrancesaService) {}

  @Get('config')
  getConfig() {
    return this.bancaFrancesaService.getConfig();
  }

  @Post('apostar')
  playRound(@Body() body: PlayDto) {
    if (!body?.userId || !Array.isArray(body?.bets)) {
      throw new BadRequestException('Informe userId e bets.');
    }
    return this.bancaFrancesaService.playRound(body.userId, body.bets);
  }
}
