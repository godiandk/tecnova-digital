import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { FriendsService } from './friends.service';
import { UsuarioAtual } from '../auth/usuario-atual.decorator';

class SendRequestDto {
  targetUserId!: string;
}

class RespondDto {
  accept!: boolean;
}

@Controller('amigos')
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Get()
  listFriends(@UsuarioAtual() userId: string) {
    if (!userId) throw new BadRequestException('Requisição inválida.');
    return this.friendsService.listFriends(userId);
  }

  @Get('pendentes')
  listPending(@UsuarioAtual() userId: string) {
    if (!userId) throw new BadRequestException('Requisição inválida.');
    return this.friendsService.listPending(userId);
  }

  @Post('pedir')
  sendRequest(@UsuarioAtual() usuarioLogado: string, @Body() body: SendRequestDto) {
    if (!body?.targetUserId) {
      throw new BadRequestException('Informe targetUserId.');
    }
    return this.friendsService.sendRequest(usuarioLogado, body.targetUserId);
  }

  @Post(':requestId/responder')
  respond(
    @UsuarioAtual() usuarioLogado: string,
    @Param('requestId') requestId: string,
    @Body() body: RespondDto,
  ) {
    if (typeof body.accept !== 'boolean') {
      throw new BadRequestException('Informe accept.');
    }
    return this.friendsService.respondToRequest(usuarioLogado, requestId, body.accept);
  }
}
