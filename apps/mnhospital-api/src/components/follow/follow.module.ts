import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import FollowSchema from './schema/Follow.model';

@Module({
	imports: [MongooseModule.forFeature([{ name: 'Follow', schema: FollowSchema }])],
	exports: [MongooseModule],
})
export class FollowModule {}
