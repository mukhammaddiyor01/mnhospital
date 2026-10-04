import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommentService } from './comment.service';
import { CommentResolver } from './comment.resolver';
import CommentSchema from './schema/Comment.model';
import { AuthModule } from '../auth/auth.module';
import { MemberModule } from '../member/member.module';
import { ServiceModule } from '../service/service.module';
import { ArticleModule } from '../article/article.module';
import { DoctorModule } from '../doctor/doctor.module';

@Module({
	imports: [
		MongooseModule.forFeature([
			{
				name: 'Comment',
				schema: CommentSchema,
			},
		]),
		AuthModule,
		MemberModule,
		ServiceModule,
		ArticleModule,
		DoctorModule,
	],
	exports: [MongooseModule, CommentService],
	providers: [CommentService, CommentResolver],
})
export class CommentModule {}
