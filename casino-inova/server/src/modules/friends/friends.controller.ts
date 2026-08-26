import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { FriendsService } from './friends.service';

class SendRequestDto {
  userId!: string;
  targetUserId!: string;
}

class RespondDto {
  userId!: string;
  accept!: boolean;
}

@Controller('amigos')
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Get()
  listFriends(@Query('userId') userId: string) {
    if (!userId) throw new BadRequestException('Informe userId.');
    return this.friendsService.listFriends(userId);
  }

  @Get('pendentes')
  listPending(@Query('userId') userId: string) {
    if (!userId) throw new BadRequestException('Informe userId.');
    return this.friendsService.listPending(userId);
  }

  @Post('pedir')
  sendRequest(@Body() body: SendRequestDto) {
    if (!body?.userId || !body?.targetUserId) {
      throw new BadRequestException('Informe userId e targetUserId.');
    }
    return this.friendsService.sendRequest(body.userId, body.targetUserId);
  }

  @Post(':requestId/responder')
  respond(@Param('requestId') requestId: string, @Body() body: RespondDto) {
    if (!body?.userId || typeof body.accept !== 'boolean') {
      throw new BadRequestException('Informe userId e accept.');
    }
    return this.friendsService.respondToRequest(body.userId, requestId, body.accept);
  }
}
