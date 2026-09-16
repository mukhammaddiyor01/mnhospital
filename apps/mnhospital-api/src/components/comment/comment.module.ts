import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import CommentSchema from './schema/Comment.model';

@Module({
	imports: [MongooseModule.forFeature([{ name: 'Comment', schema: CommentSchema }])],
	exports: [MongooseModule],
})
export class CommentModule {}
