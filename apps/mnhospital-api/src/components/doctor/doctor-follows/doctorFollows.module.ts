import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import DoctorFollowSchema from './schema/DoctorFollow.model';

@Module({
	imports: [MongooseModule.forFeature([{ name: 'DoctorFollow', schema: DoctorFollowSchema }])],
	exports: [MongooseModule],
})
export class DoctorFollowsModule {}
