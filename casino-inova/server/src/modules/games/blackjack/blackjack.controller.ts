import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { BlackjackService } from './blackjack.service';
import { UsuarioAtual } from '../../auth/usuario-atual.decorator';

class UserIdDto {
}

class BetDto extends UserIdDto {
  bet!: number;
}

class SeguroDto extends UserIdDto {
  aceitar!: boolean;
  /** Quanto apostar no seguro; sem isso, o máximo (metade da aposta). */
  valor?: number;
}

@Controller('games/blackjack')
export class BlackjackController {
  constructor(private readonly blackjackService: BlackjackService) {}

  /*
   * DEIXOU DE SER PÚBLICO: a faixa de aposta é do degrau de quem pergunta, e degrau
   * depende de saldo e nível — dois dados que só existem com alguém identificado.
   */
  @Get('config')
  getConfig(@UsuarioAtual() usuarioLogado: string) {
    return this.blackjackService.getConfig(usuarioLogado);
  }

  @Post('apostar')
  startHand(@UsuarioAtual() usuarioLogado: string, @Body() body: BetDto) {
    if (typeof body.bet !== 'number') {
      throw new BadRequestException('Informe bet.');
    }
    return this.blackjackService.startHand(usuarioLogado, body.bet);
  }

  @Post('pedir-carta')
  hit(@UsuarioAtual() usuarioLogado: string, @Body() body: UserIdDto) {
    return this.blackjackService.hit(usuarioLogado);
  }

  @Post('parar')
  stand(@UsuarioAtual() usuarioLogado: string, @Body() body: UserIdDto) {
    return this.blackjackService.stand(usuarioLogado);
  }

  @Post('dobrar')
  double(@UsuarioAtual() usuarioLogado: string, @Body() body: UserIdDto) {
    return this.blackjackService.double(usuarioLogado);
  }

  @Post('dividir')
  split(@UsuarioAtual() usuarioLogado: string, @Body() body: UserIdDto) {
    return this.blackjackService.split(usuarioLogado);
  }

  @Post('seguro')
  insurance(@UsuarioAtual() usuarioLogado: string, @Body() body: SeguroDto) {
    if (typeof body?.aceitar !== 'boolean') {
      throw new BadRequestException('Informe aceitar (true ou false).');
    }
    return this.blackjackService.responderSeguro(usuarioLogado, body.aceitar, body.valor);
  }
}
