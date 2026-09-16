import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import ConversationSchema from './schema/Conversation.model';
import MemberSchema from './schema/Member.model';
import MessageSchema from './schema/Message.model';
import RefreshTokenSchema from './schema/RefreshToken.model';

@Module({
	imports: [
		MongooseModule.forFeature([
			{ name: 'Member', schema: MemberSchema },
			{ name: 'RefreshToken', schema: RefreshTokenSchema },
			{ name: 'Conversation', schema: ConversationSchema },
			{ name: 'Message', schema: MessageSchema },
		]),
	],
	exports: [MongooseModule],
})
export class MemberModule {}
