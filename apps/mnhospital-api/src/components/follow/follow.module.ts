import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FollowService } from './follow.service';
import { FollowResolver } from './follow.resolver';
import FollowSchema from './schema/Follow.model';
import { AuthModule } from '../auth/auth.module';
import { MemberModule } from '../member/member.module';
import { LikeModule } from '../like/like.module';

@Module({
	imports: [
		MongooseModule.forFeature([
			{
				name: 'Follow',
				schema: FollowSchema,
			},
		]),
		AuthModule,
		MemberModule,
		LikeModule,
	],
	exports: [MongooseModule],
	providers: [FollowService, FollowResolver],
})
export class FollowModule {}
