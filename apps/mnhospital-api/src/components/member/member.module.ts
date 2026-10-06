import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MemberService } from './member.service';
import { MemberResolver } from './member.resolver';
import MemberSchema from './schema/Member.model';
import RefreshTokenSchema from './schema/RefreshToken.model';
import { AuthModule } from '../auth/auth.module';
import { ViewModule } from '../view/view.module';
import { LikeModule } from '../like/like.module';
import FollowSchema from '../follow/schema/Follow.model';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { SocialAuthService } from './social-auth.service';

@Module({
	imports: [
		HttpModule.register({ timeout: 10000, maxRedirects: 0 }),
		ConfigModule,
		MongooseModule.forFeature([
			{ name: 'Member', schema: MemberSchema },
			{ name: 'RefreshToken', schema: RefreshTokenSchema },
		]),
		MongooseModule.forFeature([
			{
				name: 'Follow',
				schema: FollowSchema,
			},
		]),
		AuthModule,
		ViewModule,
		LikeModule,
	],
	exports: [MongooseModule, MemberService],
	providers: [MemberService, MemberResolver, SocialAuthService],
})
export class MemberModule {}
