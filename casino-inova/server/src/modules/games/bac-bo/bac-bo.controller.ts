import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { BacBoService } from './bac-bo.service';
import { BacBoBet } from './bac-bo.engine';

class PlayDto {
  userId!: string;
  bets!: BacBoBet[];
}

@Controller('games/bac-bo')
export class BacBoController {
  constructor(private readonly bacBoService: BacBoService) {}

  @Get('config')
  getConfig() {
    return this.bacBoService.getConfig();
  }

  @Post('apostar')
  playRound(@Body() body: PlayDto) {
    if (!body?.userId || !Array.isArray(body?.bets)) {
      throw new BadRequestException('Informe userId e bets.');
    }
    return this.bacBoService.playRound(body.userId, body.bets);
  }
}
