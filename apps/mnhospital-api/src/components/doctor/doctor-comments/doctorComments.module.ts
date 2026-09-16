import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import DoctorCommentSchema from './schema/DoctorComment.model';

@Module({
	imports: [MongooseModule.forFeature([{ name: 'DoctorComment', schema: DoctorCommentSchema }])],
	exports: [MongooseModule],
})
export class DoctorCommentsModule {}
