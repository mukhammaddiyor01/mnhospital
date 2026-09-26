import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MemberService } from './member.service';
import { MemberResolver } from './member.resolver';
import ConversationSchema from './schema/Conversation.model';
import MemberSchema from './schema/Member.model';
import MessageSchema from './schema/Message.model';
import RefreshTokenSchema from './schema/RefreshToken.model';
import { AuthModule } from '../auth/auth.module';
import { ViewModule } from '../view/view.module';
import { LikeModule } from '../like/like.module';

@Module({
	imports: [
		MongooseModule.forFeature([
			{ name: 'Member', schema: MemberSchema },
			{ name: 'RefreshToken', schema: RefreshTokenSchema },
			{ name: 'Conversation', schema: ConversationSchema },
			{ name: 'Message', schema: MessageSchema },
		]),
		AuthModule,
		ViewModule,
		LikeModule,
	],
	exports: [MongooseModule, MemberService],
	providers: [MemberService, MemberResolver],
})
export class MemberModule {}
