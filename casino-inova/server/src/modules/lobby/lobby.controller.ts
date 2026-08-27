import { Controller, Get } from '@nestjs/common';
import { LobbyService } from './lobby.service';

@Controller('lobby')
export class LobbyController {
  constructor(private readonly lobbyService: LobbyService) {}

  /** A fita de ganhos do salão. Precisa de login, como todo o resto. */
  @Get('ganhos-recentes')
  ganhosRecentes() {
    return this.lobbyService.ganhosRecentes();
  }
}
