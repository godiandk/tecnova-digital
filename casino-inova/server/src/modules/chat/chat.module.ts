import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { UsersModule } from '../users/users.module';
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [UsersModule, RolesModule],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
