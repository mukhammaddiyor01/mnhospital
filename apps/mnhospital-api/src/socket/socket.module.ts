import { Module } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';
import { AuthModule } from '../components/auth/auth.module';
import { MessagingModule } from '../components/messaging/messaging.module';
import { MongooseModule } from '@nestjs/mongoose';
import GeneralChatMessageSchema from './schema/GeneralChatMessage.model';
import { GeneralChatService } from './general-chat.service';

@Module({
	imports: [AuthModule, MessagingModule, MongooseModule.forFeature([{ name: 'GeneralChatMessage', schema: GeneralChatMessageSchema }])],
	providers: [SocketGateway, GeneralChatService],
})
export class SocketModule {}
