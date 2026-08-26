import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { SlotsService } from './slots.service';

class SpinDto {
  userId!: string;
  bet!: number;
}

@Controller('games/slots')
export class SlotsController {
  constructor(private readonly slotsService: SlotsService) {}

  @Get('config')
  getConfig() {
    return this.slotsService.getConfig();
  }

  @Post('girar')
  spin(@Body() body: SpinDto) {
    if (!body?.userId || typeof body.bet !== 'number') {
      throw new BadRequestException('Informe userId e bet.');
    }
    return this.slotsService.playSpin(body.userId, body.bet);
  }
}
